-- Persist the "admin manually edited the tax field" flag on the quote so
-- the editor doesn't auto-recompute over a saved override on reopen.
--
-- When false (default): the auto-rate fires whenever subtotal/discount
-- changes. When true: the admin's exact tax_cents is preserved.

alter table public.quotes
  add column if not exists tax_manual_override boolean not null default false;

comment on column public.quotes.tax_manual_override is
  'True when the admin typed a custom tax amount in the editor. Prevents the auto-tax useEffect from overwriting the saved value on edit-mode reopen. Reset via the editor''s "Reset to auto" link.';
