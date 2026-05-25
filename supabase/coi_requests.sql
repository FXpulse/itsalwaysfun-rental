-- Certificate of Insurance (COI) requests.
-- Many venues (schools, parks, HOAs, corporate) require proof the rental
-- company has insurance with the venue named as additional insured.
-- Flow: customer requests at checkout → admin generates with their broker
-- → admin uploads PDF → customer downloads from /portal.

create table if not exists public.coi_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,

  -- Venue info (filled by customer at checkout)
  venue_name text not null,
  venue_address text,
  additional_insured text,        -- exact name to list as additional insured (often differs from venue name)
  special_instructions text,      -- "Email to facilities@school.edu", coverage minimums, etc.
  requested_by_email text not null,

  -- Lifecycle
  status text not null default 'requested'
    check (status in ('requested', 'uploaded', 'delivered_to_venue', 'cancelled')),

  -- Admin uploads
  coi_file_url text,               -- public URL to the PDF
  coi_file_path text,              -- storage path (for re-upload / delete)
  admin_notes text,

  requested_at timestamptz not null default now(),
  uploaded_at timestamptz,
  uploaded_by text,
  delivered_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coi_requests_status_idx
  on public.coi_requests(status, requested_at desc)
  where status in ('requested', 'uploaded');

create or replace function public.touch_coi_requests_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists coi_requests_set_updated_at on public.coi_requests;
create trigger coi_requests_set_updated_at
  before update on public.coi_requests
  for each row execute function public.touch_coi_requests_updated_at();

alter table public.coi_requests enable row level security;

-- Customer reads their own (matched via booking)
drop policy if exists "customer reads own coi" on public.coi_requests;
create policy "customer reads own coi"
  on public.coi_requests for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = coi_requests.booking_id
        and lower(b.customer_email) = lower(coalesce(auth.email(), ''))
    )
  );

-- Admin / staff full access
drop policy if exists "staff_or_admin manage coi" on public.coi_requests;
create policy "staff_or_admin manage coi"
  on public.coi_requests for all
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));

-- Settings: ask at checkout
insert into public.site_settings (key, value, description, category) values
  (
    'coi_request_enabled',
    'true',
    'Show "Need a Certificate of Insurance?" option at checkout. Many venues require COI for inflatable rentals.',
    'legal'
  )
on conflict (key) do nothing;
