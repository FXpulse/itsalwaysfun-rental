-- Enable RLS on mfa_recovery_codes — the table was created during the
-- 2026-06-19 audit work but never had RLS turned on, so Supabase advisor
-- flagged it as publicly accessible via the anon key.
--
-- The application only touches this table through createAdminClient
-- (service_role), which bypasses RLS by design — so a deny-all stance is
-- the right posture. No policies needed: service_role goes around RLS,
-- and anon / authenticated get a hard zero rows on every query.

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
