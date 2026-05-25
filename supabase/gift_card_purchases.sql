-- Customer-facing gift card purchases (storefront sales).
-- Flow:
--   1. Customer fills /gift-cards form → POST /api/gift-cards/purchase
--      → create row here (status='pending') + Stripe PaymentIntent
--   2. Customer pays via Stripe Elements
--   3. Stripe webhook (payment_intent.succeeded with metadata.type='gift_card_purchase')
--      → flip status='paid', create the real gift_cards row, email recipient
--   4. If payment fails → status='failed'

create table if not exists public.gift_card_purchases (
  id uuid primary key default gen_random_uuid(),

  amount_cents int not null check (amount_cents >= 1000 and amount_cents <= 1000000),

  purchaser_name text not null,
  purchaser_email text not null,
  recipient_name text,
  recipient_email text not null,
  message text,
  deliver_at timestamptz,  -- optional future delivery (null = immediate)

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled')),

  stripe_payment_intent_id text unique,

  -- Set on webhook success: the issued gift_cards row
  gift_card_id uuid references public.gift_cards(id) on delete set null,

  created_at timestamptz not null default now(),
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text
);

create index if not exists gift_card_purchases_pi_idx
  on public.gift_card_purchases(stripe_payment_intent_id);
create index if not exists gift_card_purchases_status_idx
  on public.gift_card_purchases(status, created_at desc);
create index if not exists gift_card_purchases_recipient_idx
  on public.gift_card_purchases(recipient_email);

alter table public.gift_card_purchases enable row level security;

-- Only admins can read; service role (used by webhook + API route) bypasses RLS.
drop policy if exists "admin read gift card purchases" on public.gift_card_purchases;
create policy "admin read gift card purchases"
  on public.gift_card_purchases for select
  using (public.is_admin(auth.uid()));
