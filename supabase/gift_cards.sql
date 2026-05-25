-- Gift cards: stored balance, code-based redemption at checkout.

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  original_amount_cents int not null check (original_amount_cents > 0),
  balance_cents int not null check (balance_cents >= 0),
  -- Purchaser info (optional — can be issued by admin without a payment)
  purchaser_email text,
  purchaser_name text,
  -- Recipient info (who the card is for)
  recipient_email text not null,
  recipient_name text,
  message text,
  -- Lifecycle
  issued_at timestamptz not null default now(),
  expires_at timestamptz,  -- null = never expires
  sent_to_recipient_at timestamptz,
  fully_redeemed_at timestamptz,
  -- If purchased online via Stripe, link booking/payment
  stripe_payment_intent_id text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gift_cards_code_idx on public.gift_cards(code);
create index if not exists gift_cards_recipient_email_idx on public.gift_cards(recipient_email);

-- Track redemptions per booking
create table if not exists public.gift_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  amount_cents int not null check (amount_cents > 0),
  redeemed_at timestamptz not null default now()
);

create index if not exists gift_card_redemptions_card_idx on public.gift_card_redemptions(gift_card_id);

-- Add to bookings
alter table public.bookings
  add column if not exists gift_card_code text,
  add column if not exists gift_card_amount_cents int not null default 0;

create or replace function public.touch_gift_cards_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists gift_cards_set_updated_at on public.gift_cards;
create trigger gift_cards_set_updated_at
  before update on public.gift_cards
  for each row execute function public.touch_gift_cards_updated_at();

-- Generate friendly gift card code: GIFT-XXXX-XXXX
create or replace function public.generate_gift_card_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  exists_already boolean;
begin
  loop
    code := 'GIFT-';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    code := code || '-';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select exists(select 1 from public.gift_cards where gift_cards.code = code) into exists_already;
    if not exists_already then return code; end if;
  end loop;
end;
$$;

alter table public.gift_cards enable row level security;
alter table public.gift_card_redemptions enable row level security;

drop policy if exists "admin manage gift cards" on public.gift_cards;
create policy "admin manage gift cards"
  on public.gift_cards for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin read redemptions" on public.gift_card_redemptions;
create policy "admin read redemptions"
  on public.gift_card_redemptions for select
  using (public.is_admin(auth.uid()));
