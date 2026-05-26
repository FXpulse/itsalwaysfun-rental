-- Customer-initiated booking extensions (self-service from /portal).
-- Each extension creates a separate Stripe charge + audit row, then on
-- payment_succeeded the webhook bumps bookings.event_end_date + total_amount.
-- Keeps a clean trail so refunds can target individual extensions if needed.

create table if not exists public.booking_extensions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,

  original_end_date date not null,
  new_end_date date not null,
  additional_days int not null check (additional_days > 0),
  additional_amount_cents int not null check (additional_amount_cents >= 0),

  stripe_payment_intent_id text unique,
  stripe_payment_status text not null default 'pending'
    check (stripe_payment_status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),

  requested_by_email text not null,
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists booking_extensions_booking_idx
  on public.booking_extensions(booking_id, created_at desc);
create index if not exists booking_extensions_pi_idx
  on public.booking_extensions(stripe_payment_intent_id);

alter table public.booking_extensions enable row level security;

-- Customer reads their own (via booking → customer email)
drop policy if exists "customer reads own extensions" on public.booking_extensions;
create policy "customer reads own extensions"
  on public.booking_extensions for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_extensions.booking_id
        and lower(b.customer_email) = lower(coalesce(auth.email(), ''))
    )
  );

drop policy if exists "staff_or_admin manage extensions" on public.booking_extensions;
create policy "staff_or_admin manage extensions"
  on public.booking_extensions for all
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));
