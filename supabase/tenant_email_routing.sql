-- Multi-tenant email routing (2026-06-03)
--
-- IAF and any future "premium" tenant get a Cloudflare Email Worker →
-- /admin/inbox flow (inbox_enabled = true). All other tenants use the
-- simpler pattern:
--   - From: "Tenant Brand" <noreply@email.getrentalflow.com>
--   - Reply-To: <notification_email> (tenant's own Gmail/Outlook/etc.)
-- so customer replies go straight to the tenant's existing inbox without
-- requiring them to use /admin/inbox or set up DNS.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS notification_email text,
  ADD COLUMN IF NOT EXISTS inbox_enabled boolean NOT NULL DEFAULT false;

-- Backfill: tenants without a notification_email default to owner_email
UPDATE public.tenants
SET notification_email = owner_email
WHERE notification_email IS NULL AND owner_email IS NOT NULL;

-- IAF keeps the in-app inbox (Cloudflare Worker → /admin/inbox path).
UPDATE public.tenants
SET inbox_enabled = true
WHERE id = '11111111-1111-1111-1111-111111111111';
