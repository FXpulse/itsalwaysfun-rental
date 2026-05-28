-- Add surface_type + needs_power_supply to quotes (parity with bookings).
-- Quote admin form now requires these before sending so dispatch knows
-- what anchors/generator to bring once the quote is approved.

alter table quotes
  add column if not exists surface_type text,
  add column if not exists needs_power_supply boolean;

-- Same allowed values as bookings (lib/delivery-checklist mirrors these).
alter table quotes
  drop constraint if exists quotes_surface_type_check;
alter table quotes
  add constraint quotes_surface_type_check
  check (surface_type is null or surface_type in
    ('dirt','grass','concrete','paver','asphalt','other'));

comment on column quotes.surface_type is
  'Where the inflatable will be set up. Mirrors bookings.surface_type. Required when sending the quote so dispatch knows what anchors to bring on approval.';
comment on column quotes.needs_power_supply is
  'true=customer needs a portable generator, false=customer has outlet within ~75ft, null=not asked yet.';
