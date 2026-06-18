-- MFA recovery codes — emergency single-use codes for when an admin loses
-- their authenticator device. Each code is a 10-char random string. We
-- store only the hash; the plaintext is shown to the user ONCE at
-- generation time and never retrievable again.
--
-- Using a recovery code does NOT bypass MFA — it RESETS MFA. The user's
-- TOTP factor is deleted, the user logs in with just password, and the
-- next /admin visit forces them to enroll a new factor. That model is
-- defensible: a code can't be used as a long-term MFA bypass.

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user
  ON mfa_recovery_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_unused
  ON mfa_recovery_codes(user_id) WHERE used_at IS NULL;

-- No RLS — the table is only ever touched by the service role from
-- server actions. Users never query it from their own session.
