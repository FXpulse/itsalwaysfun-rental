-- Delivery/pickup proofs (photos + customer signature) + damage tracking.

-- ─── BOOKING PROOFS ───────────────────────────────────────────────────────
create table if not exists public.booking_proofs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  phase text not null check (phase in ('delivery','pickup')),
  captured_at timestamptz not null default now(),
  captured_by text,                          -- staff email
  customer_signature_url text,
  customer_signature_name text,              -- typed name accompanying signature
  -- photos stored as jsonb array: [{url, caption, sort_order}, ...]
  photos jsonb not null default '[]'::jsonb,
  condition_notes text,
  unique (booking_id, phase)
);

create index if not exists booking_proofs_booking_idx on public.booking_proofs(booking_id);

alter table public.booking_proofs enable row level security;

drop policy if exists "staff_or_admin read proofs" on public.booking_proofs;
create policy "staff_or_admin read proofs"
  on public.booking_proofs
  for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "staff_or_admin manage proofs" on public.booking_proofs;
create policy "staff_or_admin manage proofs"
  on public.booking_proofs
  for all
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));

-- ─── BOOKING DAMAGES ──────────────────────────────────────────────────────
create table if not exists public.booking_damages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  description text not null,
  severity text not null default 'minor' check (severity in ('minor','moderate','major')),
  cost_cents int not null default 0 check (cost_cents >= 0),
  customer_responsible boolean not null default false,
  charged_to_customer boolean not null default false,  -- mark when admin charges
  photo_url text,
  recorded_at timestamptz not null default now(),
  recorded_by text,
  resolved boolean not null default false,             -- repaired/dealt with
  notes text
);

create index if not exists booking_damages_booking_idx on public.booking_damages(booking_id);
create index if not exists booking_damages_inventory_idx on public.booking_damages(inventory_item_id);
create index if not exists booking_damages_unresolved_idx on public.booking_damages(resolved) where resolved = false;

alter table public.booking_damages enable row level security;

drop policy if exists "staff_or_admin read damages" on public.booking_damages;
create policy "staff_or_admin read damages"
  on public.booking_damages
  for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "staff_or_admin manage damages" on public.booking_damages;
create policy "staff_or_admin manage damages"
  on public.booking_damages
  for all
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));
