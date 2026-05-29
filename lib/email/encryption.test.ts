// lib/email/encryption.test.ts
import { describe, it, expect } from "vitest";

const KEY = "C2GhZ2lEnPlrXSPfWklJfLF3JJOZc9c0vJpvHkGjGqM="; // base64 32 bytes
process.env.EMAIL_ENCRYPTION_KEY = KEY;

// Import AFTER env var is set
import { encryptPassword, decryptPassword } from "./encryption";

describe("encryption", () => {
  it("round-trips a password", () => {
    const plain = "Il8bbf164";
    const ct = encryptPassword(plain);
    expect(ct).not.toBe(plain);
    expect(decryptPassword(ct)).toBe(plain);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const a = encryptPassword("same-password");
    const b = encryptPassword("same-password");
    expect(a).not.toBe(b);
    expect(decryptPassword(a)).toBe("same-password");
    expect(decryptPassword(b)).toBe("same-password");
  });

  it("rejects tampered ciphertext", () => {
    const ct = encryptPassword("secret");
    // flip a byte in the middle (after the 12-byte IV)
    const buf = Buffer.from(ct, "base64");
    buf[20] = buf[20] ^ 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it("handles unicode + long passwords", () => {
    const plain = "Ñoño-密码-🎉-very-long-password-with-many-chars";
    expect(decryptPassword(encryptPassword(plain))).toBe(plain);
  });
});
