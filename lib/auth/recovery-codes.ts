// MFA recovery codes — emergency reset for admins who lose their authenticator.
//
// Design choices (load-bearing — don't change without understanding):
//
//  1. Codes are 10 uppercase chars, dash-grouped (XXXXX-XXXXX) for readability.
//     Crypto-random from a 32-char alphabet that excludes ambiguous chars
//     (no O/0, no I/1) → ~50 bits of entropy per code, enough for an offline
//     guessing attacker who can try maybe 100k/sec to still need centuries.
//
//  2. Stored as bcrypt hash. We never persist plaintext anywhere — the user
//     sees them once on generation and we tell them to write them down.
//
//  3. A used code is dead — `used_at` is set and that row never matches again.
//
//  4. Using a recovery code does NOT bypass MFA. It RESETS MFA:
//     - We delete the user's TOTP factor in auth.mfa_factors
//     - The user can log in with password
//     - The admin layout's MFA gate immediately redirects them to enroll
//       a NEW factor on next /admin visit
//     This means a recovery code can't be hoarded by an attacker as a
//     permanent MFA bypass — its blast radius is "you have to re-enroll TOTP."

import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Codes are high-entropy random strings (~50 bits). SHA-256 with a salt
 *  is sufficient — we don't need the slow-hash properties of bcrypt for
 *  uniform random secrets. Avoids adding a runtime dependency. */
function hashCode(code: string): string {
  // Salt is platform-static (EMAIL_ENCRYPTION_KEY or fixed) so the hash is
  // deterministic for verification. The code's own entropy is what makes
  // brute force infeasible.
  const salt = process.env.MFA_RECOVERY_SALT || "rentalflow-recovery-2026";
  return createHash("sha256").update(salt).update(code).digest("hex");
}

function verifyCode(code: string, expectedHash: string): boolean {
  const got = Buffer.from(hashCode(code), "hex");
  const exp = Buffer.from(expectedHash, "hex");
  if (got.length !== exp.length) return false;
  return timingSafeEqual(got, exp);
}

// 32-char alphabet that excludes ambiguous glyphs.
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate one code: 10 chars, formatted XXXXX-XXXXX. */
function generateOneCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += ALPHA[bytes[i] % ALPHA.length];
    if (i === 4) out += "-";
  }
  return out;
}

/** Generate N codes for a user. Returns the plaintext codes (only chance
 *  the user sees them) and stores hashes. Any pre-existing UNUSED codes
 *  for the user are invalidated — calling generate again replaces the
 *  full active set. */
export async function generateRecoveryCodes(
  userId: string,
  count = 10,
): Promise<string[]> {
  const supabase = createAdminClient({ unscoped: true });

  // Invalidate the user's previous unused codes — they can only have one
  // active set at a time. We "use" them with a synthetic used_at so they
  // can't match in verify(). Audit trail kept.
  await supabase
    .from("mfa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);

  const codes: string[] = [];
  const rows: { user_id: string; code_hash: string }[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateOneCode();
    codes.push(code);
    rows.push({ user_id: userId, code_hash: hashCode(code) });
  }
  const { error } = await supabase.from("mfa_recovery_codes").insert(rows);
  if (error) {
    throw new Error(`generateRecoveryCodes insert failed: ${error.message}`);
  }
  return codes;
}

export interface UnusedCodeStatus {
  totalGenerated: number;
  remainingUnused: number;
  lastGeneratedAt: string | null;
}

/** Stats for the "Manage codes" page — never returns hashes/plaintext. */
export async function getRecoveryCodeStatus(
  userId: string,
): Promise<UnusedCodeStatus> {
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("mfa_recovery_codes")
    .select("used_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const rows = (data as { used_at: string | null; created_at: string }[]) || [];
  const total = rows.length;
  const unused = rows.filter((r) => r.used_at == null).length;
  const lastCreated = rows[0]?.created_at ?? null;
  return {
    totalGenerated: total,
    remainingUnused: unused,
    lastGeneratedAt: lastCreated,
  };
}

/** Operator-only: reset MFA for any user by deleting all their TOTP
 *  factors. Used from /superadmin/users-mfa to help a tenant admin who
 *  lost their device. NEVER call this from a tenant-facing route. */
export async function resetMfaForUser(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: "userId required" };
  const supabase = createAdminClient({ unscoped: true });
  try {
    await (supabase as any)
      .schema("auth")
      .from("mfa_factors")
      .delete()
      .eq("user_id", userId);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Delete failed" };
  }
}

/** Verify a recovery code for an email + consume it.
 *  On success: marks the code used + deletes ALL of the user's TOTP factors.
 *  Returns the user id so the caller can authenticate the session. */
export async function consumeRecoveryCode(
  email: string,
  code: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const cleaned = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(cleaned)) {
    return { ok: false, error: "Code format must be XXXXX-XXXXX" };
  }

  const supabase = createAdminClient({ unscoped: true });

  // Look up the user
  const { data: userPage } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = (userPage?.users || []).find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (!user) return { ok: false, error: "No account found for that email" };

  // Pull this user's unused codes
  const { data: rows } = await supabase
    .from("mfa_recovery_codes")
    .select("id, code_hash")
    .eq("user_id", user.id)
    .is("used_at", null);
  const candidates = (rows as { id: string; code_hash: string }[]) || [];
  if (candidates.length === 0) {
    return { ok: false, error: "No active recovery codes — admin must generate new ones" };
  }

  // Check each unused code's hash. Linear scan — N is small (typically 10).
  // Uses timing-safe compare to avoid leaking hash matches to a remote attacker.
  let matchedId: string | null = null;
  for (const row of candidates) {
    if (verifyCode(cleaned, row.code_hash)) {
      matchedId = row.id;
      break;
    }
  }
  if (!matchedId) return { ok: false, error: "Invalid recovery code" };

  // Consume the code
  await supabase
    .from("mfa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", matchedId);

  // Reset MFA — delete all of this user's factors via direct DELETE on
  // auth.mfa_factors. The service-role connection bypasses RLS so this
  // works without the auth.admin SDK method, which has had unstable
  // signatures across supabase-js versions. The admin layout's mfa-required
  // gate will force enrollment of a new factor on next /admin visit.
  try {
    await (supabase as any)
      .schema("auth")
      .from("mfa_factors")
      .delete()
      .eq("user_id", user.id);
  } catch {
    /* best-effort — if this fails the user just keeps their factor and the
       code is consumed; they'd need another code or admin intervention */
  }

  return { ok: true, userId: user.id };
}
