-- ─────────────────────────────────────────────────────────────────────────
-- LOW-STOCK ALERTS for inventory_items
-- ─────────────────────────────────────────────────────────────────────────
-- Adds a per-item threshold. Daily cron (/api/cron/low-stock-alert) finds
-- items where (quantity_owned - quantity_in_use) <= low_stock_threshold AND
-- low_stock_threshold > 0 AND is_active=true, then emails the admin.
--
-- Threshold of 0 (default) = disabled. Set to e.g. 2 to alert when you only
-- have 2 of that item left on hand.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.inventory_items
  add column if not exists low_stock_threshold int not null default 0
    check (low_stock_threshold >= 0);

-- Track when the last alert was sent for each item so the cron doesn't email
-- the same item every day (only re-alert when stock goes back above and then
-- back below). NULL = never alerted.
alter table public.inventory_items
  add column if not exists low_stock_alerted_at timestamptz;

-- Index lets the cron quickly find active items with thresholds set
create index if not exists inventory_items_low_stock_idx
  on public.inventory_items(is_active, low_stock_threshold)
  where is_active = true and low_stock_threshold > 0;

-- Site setting: where to send the alert email (defaults to ADMIN_ALERT_EMAIL env)
insert into public.site_settings (key, value, description, category) values
  (
    'low_stock_alert_email',
    '',
    'Email address that receives daily low-stock inventory alerts. Leave blank to use the ADMIN_ALERT_EMAIL env var.',
    'inventory'
  )
on conflict (key) do nothing;
