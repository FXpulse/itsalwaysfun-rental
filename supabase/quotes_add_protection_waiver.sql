-- Damage protection (optional, admin offers, customer accepts/rejects) +
-- liability waiver gate (admin requires, customer signs before payment).
-- Both live on the quote so each quote is self-contained — if site_settings
-- change later, this quote still honors the snapshot.

alter table quotes
  add column if not exists damage_protection_offered boolean default false,
  add column if not exists damage_protection_cents integer default 0,
  add column if not exists damage_protection_accepted boolean,
  add column if not exists waiver_required boolean default true,
  add column if not exists waiver_signed_name text,
  add column if not exists waiver_signed_at timestamptz;

comment on column quotes.damage_protection_offered is
  'Admin opt-in: when true, the customer sees a damage protection upsell on the public quote page. Price snapshot lives in damage_protection_cents.';
comment on column quotes.damage_protection_cents is
  'Price snapshot at quote creation. Decoupled from site_settings so a later price change does not retroactively alter this quote.';
comment on column quotes.damage_protection_accepted is
  'Customer choice: true=opted in (price added to booking), false=opted out, null=not asked / admin did not offer.';
comment on column quotes.waiver_required is
  'When true, customer must sign the liability waiver before payment proceeds. Admin can drop the gate per quote.';
comment on column quotes.waiver_signed_name is
  'Customer typed-name signature captured at approval time. Stored verbatim for evidentiary purposes.';
