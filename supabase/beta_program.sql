-- supabase/beta_program.sql
--
-- Adds tracking for the "first 90 days" beta program. Any tenant signing
-- up while BETA_PROGRAM_END_AT (env var) is in the future gets:
--   - 90-day trial (vs default 30)
--   - beta_program flag = true
--   - beta_program_joined_at = signup timestamp
--
-- The flag lets superadmin filter the beta cohort and target them with
-- specific lifecycle emails / outreach. After day 90 they transition to
-- $99/mo normal pricing — no special discount post-beta (per 2026-06-17
-- decision: "Plan normal $99/mo, sin descuento").

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS beta_program boolean DEFAULT false NOT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS beta_program_joined_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_tenants_beta_program ON tenants (beta_program) WHERE beta_program = true;
