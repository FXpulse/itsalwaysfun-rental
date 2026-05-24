-- Quotes & approval flow.
--
-- Admin creates a quote with line items (products or custom items).
-- Customer receives a magic link, approves/declines.
-- On approve: a booking is created (status pending_payment) and customer
-- pays via Stripe inline. On decline: quote is marked declined.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null,                  -- Q-2026-001
  token text unique not null,                         -- random 32-char hex for magic link

  -- Customer info (denormalized so quote stands alone if user edits booking later)
  customer_first_name text not null,
  customer_last_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_address text,

  -- Event
  event_date date not null,
  event_end_date date,
  start_time time,
  end_time time,

  -- Line items as jsonb (keeps schema simple)
  -- Each: { product_id?, name, description?, quantity, unit_price_cents, line_total_cents }
  line_items jsonb not null default '[]'::jsonb,

  -- Pricing
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  discount_note text,                                 -- e.g. "10% loyalty discount"
  tax_cents int not null default 0,
  total_cents int not null default 0,

  -- Customer-facing message + admin notes
  customer_message text,                              -- shown on the quote page
  internal_notes text,                                -- admin-only

  -- Status flow: draft → sent → viewed → approved/declined/expired → converted
  status text not null default 'draft' check (status in ('draft','sent','viewed','approved','declined','expired','converted')),

  -- Lifecycle timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  expires_at timestamptz default (now() + interval '14 days'),

  -- Conversion
  converted_booking_id uuid references public.bookings(id) on delete set null,

  -- Admin who created it (for audit)
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists quotes_status_idx on public.quotes(status);
create index if not exists quotes_customer_email_idx on public.quotes(customer_email);
create index if not exists quotes_token_idx on public.quotes(token);
create index if not exists quotes_event_date_idx on public.quotes(event_date);

-- Touch updated_at
create or replace function public.touch_quotes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.touch_quotes_updated_at();

-- Generate quote_number: Q-{year}-{count+1 zero-padded to 4}
create or replace function public.next_quote_number()
returns text language plpgsql as $$
declare
  y text;
  c int;
begin
  y := to_char(now(), 'YYYY');
  select coalesce(count(*), 0) + 1 into c
  from public.quotes
  where quote_number like 'Q-' || y || '-%';
  return 'Q-' || y || '-' || lpad(c::text, 4, '0');
end;
$$;

-- Generate random 32-char hex token
create or replace function public.new_quote_token()
returns text language sql as $$
  select encode(gen_random_bytes(16), 'hex');
$$;

-- RLS: admin can full access. Public can read by token only (handled in API).
alter table public.quotes enable row level security;

drop policy if exists "admin manage quotes" on public.quotes;
create policy "admin manage quotes"
  on public.quotes
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Staff can read quotes (for context on bookings) but not edit
drop policy if exists "staff read quotes" on public.quotes;
create policy "staff read quotes"
  on public.quotes
  for select
  using (public.is_staff_or_admin(auth.uid()));
