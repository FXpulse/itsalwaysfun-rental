-- Add VIN + license tag columns to fleet tables (vehicles + trailers).
-- Both are optional free-text. VIN is shown as monospace for readability.

alter table public.vehicles
  add column if not exists vin text,
  add column if not exists license_tag text;

alter table public.trailers
  add column if not exists vin text,
  add column if not exists license_tag text;

-- Indexes for searching by VIN or tag (partial — only when set)
create index if not exists vehicles_vin_idx
  on public.vehicles(vin) where vin is not null;
create index if not exists vehicles_tag_idx
  on public.vehicles(license_tag) where license_tag is not null;
create index if not exists trailers_vin_idx
  on public.trailers(vin) where vin is not null;
create index if not exists trailers_tag_idx
  on public.trailers(license_tag) where license_tag is not null;
