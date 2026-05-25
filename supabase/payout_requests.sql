-- Payout requests: customer (referrer) requests their commission be paid out.
-- Two payout types:
--   'stripe' — cash payout (admin sends via Stripe/Venmo/Zelle). Requires W9
--             on file for 1099 reporting.
--   'credit' — issued as a gift card for the referrer to use on a future
--             rental. NOT taxable — no W9 needed.

-- W9 file URL stored on customer_profiles (1 W9 per person, reused for future
-- payouts within the year)
alter table public.customer_profiles
  add column if not exists w9_url text,
  add column if not exists w9_uploaded_at timestamptz,
  add column if not exists w9_tax_year int;  -- which tax year the W9 applies to

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  payout_type text not null check (payout_type in ('stripe', 'credit')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'processed', 'cancelled')),
  -- W9 snapshot at request time (for stripe type)
  w9_url text,
  -- For credit type, the gift card issued on approval
  linked_gift_card_id uuid references public.gift_cards(id) on delete set null,
  -- Audit
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  processed_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  customer_notes text,
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists payout_requests_user_idx on public.payout_requests(user_id, requested_at desc);
create index if not exists payout_requests_status_idx on public.payout_requests(status) where status = 'pending';

alter table public.payout_requests enable row level security;

-- Users can read + create their own requests
drop policy if exists "users read own payout requests" on public.payout_requests;
create policy "users read own payout requests"
  on public.payout_requests for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own payout requests" on public.payout_requests;
create policy "users insert own payout requests"
  on public.payout_requests for insert
  with check (auth.uid() = user_id);

-- Admin can do everything
drop policy if exists "admin manage payout requests" on public.payout_requests;
create policy "admin manage payout requests"
  on public.payout_requests for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
