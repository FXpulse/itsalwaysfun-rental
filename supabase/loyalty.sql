-- Loyalty + Referrals foundation.
--
-- Concepts:
--   customer_profiles: 1 row per portal-authed customer. Stores their unique
--     referral code + balances (points + commission earned vs paid out).
--   loyalty_transactions: ledger row per points/commission event (audit trail).
--
-- Settings rows in site_settings (category 'loyalty'):
--   loyalty_points_per_dollar       (default 1, int) — points earned per $ spent
--   loyalty_points_redemption_rate  (default 100, int) — 100 points = $1
--   referral_commission_pct         (default 10, int) — % of referred booking
--   loyalty_min_redeem_points       (default 500, int) — min to redeem

-- ─── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text unique not null,
  referred_by_user_id uuid references auth.users(id) on delete set null,
  loyalty_points int not null default 0 check (loyalty_points >= 0),
  commission_pending_cents int not null default 0 check (commission_pending_cents >= 0),
  commission_paid_cents int not null default 0 check (commission_paid_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_profiles_ref_code_idx on public.customer_profiles(referral_code);
create index if not exists customer_profiles_referred_by_idx on public.customer_profiles(referred_by_user_id);

create or replace function public.touch_customer_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_profiles_set_updated_at on public.customer_profiles;
create trigger customer_profiles_set_updated_at
  before update on public.customer_profiles
  for each row execute function public.touch_customer_profiles_updated_at();

-- Ledger
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'booking_points',         -- customer earned points for paying a booking
    'referral_commission',    -- customer earned commission for referring a paid customer
    'points_redeemed',        -- customer used points at checkout (subtracts)
    'commission_payout',      -- admin paid out commission (clears pending)
    'admin_adjustment'        -- admin manual adjustment (+ or -)
  )),
  points int not null default 0,           -- can be negative for redemptions
  commission_cents int not null default 0, -- can be negative for payouts
  booking_id uuid references public.bookings(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_tx_user_idx on public.loyalty_transactions(user_id, created_at desc);
create index if not exists loyalty_tx_booking_idx on public.loyalty_transactions(booking_id);

-- ─── Helpers ───────────────────────────────────────────────────────────────
-- Generate a short, friendly referral code (uppercase letters + numbers, no 0/O/1/I)
create or replace function public.generate_referral_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select exists(select 1 from public.customer_profiles where referral_code = code) into exists_already;
    if not exists_already then
      return code;
    end if;
  end loop;
end;
$$;

-- Look up or create profile. Returns the user_id (same as input).
create or replace function public.ensure_customer_profile(uid uuid)
returns text language plpgsql as $$
declare
  existing_code text;
  new_code text;
begin
  select referral_code into existing_code from public.customer_profiles where user_id = uid;
  if existing_code is not null then
    return existing_code;
  end if;
  new_code := public.generate_referral_code();
  insert into public.customer_profiles (user_id, referral_code)
    values (uid, new_code)
    on conflict (user_id) do nothing;
  -- Re-read in case of race
  select referral_code into existing_code from public.customer_profiles where user_id = uid;
  return existing_code;
end;
$$;

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.customer_profiles enable row level security;
alter table public.loyalty_transactions enable row level security;

-- Users see their own profile
drop policy if exists "users read own profile" on public.customer_profiles;
create policy "users read own profile"
  on public.customer_profiles
  for select
  using (auth.uid() = user_id);

-- Admins see all
drop policy if exists "admin manage profiles" on public.customer_profiles;
create policy "admin manage profiles"
  on public.customer_profiles
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Users see their own transactions
drop policy if exists "users read own tx" on public.loyalty_transactions;
create policy "users read own tx"
  on public.loyalty_transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "admin manage tx" on public.loyalty_transactions;
create policy "admin manage tx"
  on public.loyalty_transactions
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─── Settings ──────────────────────────────────────────────────────────────
insert into public.site_settings (key, value, description, category) values
  ('loyalty_points_per_dollar', '1', 'Points earned per dollar spent (paid bookings only)', 'loyalty'),
  ('loyalty_points_redemption_rate', '100', 'How many points equal $1 when redeemed (e.g. 100 → 100 points = $1)', 'loyalty'),
  ('referral_commission_pct', '10', 'Percent commission earned by the referrer on a referred customer''s first paid booking', 'loyalty'),
  ('loyalty_min_redeem_points', '500', 'Minimum points balance required to redeem at checkout', 'loyalty')
on conflict (key) do nothing;
