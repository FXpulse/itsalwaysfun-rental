// MFA recovery codes — emergency reset for admins who lose their authenticator.
//
// Design choices (load-bearing — don't change without understanding):
//
//  1. Codes are 10 uppercase chars, dash-grouped (XXXXX-XXXXX) for readability.
//     Crypto-random from a 32-char alphabet that excludes ambiguous chars
//     (no O/0, no I/1) → ~50 bits of entropy per code.
//
//  2. Stored as `scrypt:<salt_hex>:<hash_hex>` with a per-code random salt
//     + a server-secret pepper (MFA_RECOVERY_SALT env). The scrypt cost
//     parameters slow an offline attacker who has both the DB and the
//     pepper. Pre-existing rows hashed with SHA-256+pepper still verify
//     transparently via the dual-format check below; they get re-hashed
//     into the scrypt format the next time the user regenerates a set.
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

import { randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// scrypt cost — N=2^14 keeps verification under ~50ms on a modern CPU,
// which is fine for one-per-login-attempt verification with rate limits.
const SCRYPT_N = 1 << 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 32;

function getPepper(): string {
  return process.env.MFA_RECOVERY_SALT || "rentalflow-recovery-2026";
}

/** Hash a fresh code with scrypt + per-code salt + pepper. */
function hashCode(code: string): string {
  const salt = randomBytes(16);
  const pepper = getPepper();
  const hash = scryptSync(code, Buffer.concat([salt, Buffer.from(pepper)]), SCRYPT_KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Legacy SHA-256+pepper format used by codes generated before 2026-06-19.
 *  Hash is a plain 64-char hex string (no colons). Kept only for verify. */
function legacySha256Hash(code: string): string {
  const pepper = getPepper();
  return createHash("sha256").update(pepper).update(code).digest("hex");
}

function verifyCode(code: string, storedHash: string): boolean {
  // New format: scrypt:<salt_hex>:<hash_hex>
  if (storedHash.startsWith("scrypt:")) {
    const parts = storedHash.split(":");
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const pepper = getPepper();
    const got = scryptSync(code, Buffer.concat([salt, Buffer.from(pepper)]), SCRYPT_KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    if (got.length !== expected.length) return false;
    return timingSafeEqual(got, expected);
  }
  // Legacy format: plain SHA-256 hex.
  const got = Buffer.from(legacySha256Hash(code), "hex");
  const exp = Buffer.from(storedHash, "hex");
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
  // verifyCode handles both legacy (SHA-256 hex) and new (scrypt:salt:hash)
  // formats so existing codes keep working without a backfill migration.
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
