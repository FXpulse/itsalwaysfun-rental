-- supabase/require_admin_mfa.sql
--
-- Adds a per-tenant policy switch: when set to 'true', admin-role users
-- without an enrolled TOTP factor are gated to /admin/settings/security
-- (and /admin/logout) until they enroll. Existing tenants default to
-- 'false' so this migration doesn't lock anyone out — they opt in from
-- /admin/settings/security.
--
-- Read at the admin layout (server component, no middleware overhead).
-- Idempotent: ON CONFLICT (key, tenant_id) DO NOTHING.

INSERT INTO site_settings (tenant_id, key, value, description, category)
SELECT
  t.id,
  'require_admin_mfa',
  'false',
  'When true, admin users without 2FA enrolled are blocked from /admin until they enroll. Staff role is not gated.',
  'security'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings s
  WHERE s.tenant_id = t.id AND s.key = 'require_admin_mfa'
);
