// scripts/rotate-email-encryption-key.ts
//
// Rotate EMAIL_ENCRYPTION_KEY for all stored IMAP/SMTP credentials in
// email_accounts.encrypted_password.
//
// Each row's ciphertext is decrypted with EMAIL_ENCRYPTION_KEY_OLD and
// re-encrypted with EMAIL_ENCRYPTION_KEY_NEW, then written back. The
// pre/post values are printed so a human can diff.
//
// Run:
//   EMAIL_ENCRYPTION_KEY_OLD=<old base64 32-byte key> \
//   EMAIL_ENCRYPTION_KEY_NEW=<new base64 32-byte key> \
//   NEXT_PUBLIC_SUPABASE_URL=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   npx tsx scripts/rotate-email-encryption-key.ts
//
// Defaults to a dry-run. Add --apply to actually write.

import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function decryptWith(keyB64: string, encrypted: string): string {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error(`key must decode to 32 bytes (got ${key.length})`);
  }
  const buf = Buffer.from(encrypted, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("encrypted blob too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

function encryptWith(keyB64: string, plaintext: string): string {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error(`key must decode to 32 bytes (got ${key.length})`);
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

async function main() {
  const APPLY = process.argv.includes("--apply");

  const OLD = process.env.EMAIL_ENCRYPTION_KEY_OLD;
  const NEW = process.env.EMAIL_ENCRYPTION_KEY_NEW;
  const URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!OLD || !NEW) {
    console.error(
      "Missing EMAIL_ENCRYPTION_KEY_OLD and/or EMAIL_ENCRYPTION_KEY_NEW.",
    );
    process.exit(1);
  }
  if (!URL || !SVC) {
    console.error("Missing Supabase URL or SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (OLD === NEW) {
    console.error("OLD and NEW keys are identical. Nothing to do.");
    process.exit(1);
  }

  // Sanity: both must decode to 32 bytes
  for (const [name, k] of [
    ["OLD", OLD],
    ["NEW", NEW],
  ] as const) {
    const b = Buffer.from(k, "base64");
    if (b.length !== 32) {
      console.error(
        `${name} key must decode to 32 bytes (got ${b.length}). Use \`openssl rand -base64 32\`.`,
      );
      process.exit(1);
    }
  }

  const supabase = createClient(URL, SVC, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: accounts, error } = await supabase
    .from("email_accounts")
    .select("id, brand, label, email_address, encrypted_password");

  if (error) {
    console.error("Could not list email_accounts:", error.message);
    process.exit(1);
  }
  const rows = accounts || [];
  console.log(`Found ${rows.length} email_account row(s) to re-encrypt.`);
  if (rows.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log(APPLY ? "\nMODE: APPLY (writing changes)\n" : "\nMODE: DRY-RUN (no changes)\n");

  let ok = 0;
  let fail = 0;
  for (const row of rows as any[]) {
    process.stdout.write(
      `  ${row.brand}/${row.label} (${row.email_address}) ... `,
    );
    try {
      const plain = decryptWith(OLD, row.encrypted_password);
      const reEnc = encryptWith(NEW, plain);
      // Verify round-trip with NEW key
      const verify = decryptWith(NEW, reEnc);
      if (verify !== plain) {
        throw new Error("round-trip mismatch (sanity check failed)");
      }

      if (APPLY) {
        const { error: updErr } = await supabase
          .from("email_accounts")
          .update({ encrypted_password: reEnc })
          .eq("id", row.id);
        if (updErr) throw new Error(`update failed: ${updErr.message}`);
        console.log("re-encrypted + written ✓");
      } else {
        console.log("re-encrypted ✓ (dry-run, not written)");
      }
      ok++;
    } catch (e: any) {
      console.log(`FAILED: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nResult: ${ok} OK, ${fail} failed.`);
  if (fail > 0) {
    console.error("\nNOT all rows succeeded. DO NOT rotate the live key yet.");
    process.exit(1);
  }
  if (!APPLY) {
    console.log("\nDry-run complete. Re-run with --apply to write changes.");
  } else {
    console.log("\nDone. Now update EMAIL_ENCRYPTION_KEY in Vercel env to the NEW value.");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
