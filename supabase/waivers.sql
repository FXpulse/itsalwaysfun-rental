-- Liability waiver e-signature at checkout.
-- Customer types their full legal name + checks "I have read and agree".
-- We snapshot the exact waiver text + IP + UA so the record is legally defensible
-- even if the template is edited later.

-- ── 1. Settings ─────────────────────────────────────────────────
-- Default template covers the standard bounce-house liability points.
-- Admin can edit text via /admin/waiver.
insert into public.site_settings (key, value, description, category) values
  (
    'waiver_enabled',
    'true',
    'Require customers to sign a liability waiver at checkout. Set to false to skip (not recommended for inflatables).',
    'legal'
  ),
  (
    'waiver_title',
    'Rental Agreement & Liability Waiver',
    'Title shown above the waiver text at checkout.',
    'legal'
  ),
  (
    'waiver_text',
    E'PLEASE READ CAREFULLY BEFORE SIGNING.\n\nIn consideration of being permitted to rent inflatable amusement equipment ("Equipment") from It''s Always Fun, LLC ("Company"), I, the undersigned ("Renter"), agree to the following:\n\n1. ASSUMPTION OF RISK. I understand that the use of inflatable amusement equipment involves inherent risks of injury — including but not limited to bruises, sprains, fractures, concussions, and in rare cases more serious injury or death. I voluntarily accept and assume all such risks for myself, my family, my guests, and any participants at my event.\n\n2. SUPERVISION. I agree that I (or a responsible adult I designate, age 18+) will supervise the Equipment AT ALL TIMES while it is in use. I will not permit horseplay, flips, climbing on netting/walls, food/drink/silly string/sharp objects inside the Equipment, or use during rain, lightning, or winds over 15 mph. I will deflate the Equipment immediately if any safety concern arises.\n\n3. PARTICIPANT LIMITS. I will enforce the manufacturer''s posted weight and capacity limits. Children of significantly different sizes will not jump together. Shoes, eyeglasses, jewelry, and sharp objects must be removed before entry.\n\n4. SETUP / TAKEDOWN. I will ensure the setup area is clean, level, free of sharp objects, and clear of overhead power lines. I will not move, modify, or attempt to repair the Equipment. I will not allow the Equipment to be used during electrical storms or in unsafe weather.\n\n5. INDEMNIFICATION. I agree to indemnify, defend, and hold harmless It''s Always Fun, LLC, its owners, employees, contractors, and agents from any and all claims, damages, suits, costs, or expenses (including attorney''s fees) arising from any injury, death, or property damage caused to any person on, in, or near the Equipment during the rental period, except where caused by the Company''s gross negligence.\n\n6. DAMAGE TO EQUIPMENT. I agree that I am financially responsible for any damage to the Equipment beyond normal wear and tear, including damage caused by my guests. If I purchased the optional damage protection, my liability is limited to the protection''s coverage cap. Damage from prohibited use (sharp objects, food, silly string, unsupervised use) is NOT covered.\n\n7. WEATHER / CANCELLATION. If weather conditions are unsafe (sustained winds 15+ mph, lightning within 6 miles, heavy rain), I will deflate the Equipment and call the Company. Weather-related cancellation policies are described separately and may include rental credit instead of a refund.\n\n8. ACKNOWLEDGMENT. By signing below (typing my full legal name), I acknowledge that I have read, understood, and voluntarily agreed to this Rental Agreement and Liability Waiver. I am at least 18 years old and have legal authority to bind myself and the event participants.\n\nThis is a legally binding agreement. If you do not agree, do not sign and contact us to cancel your rental.',
    'Full waiver text — supports paragraphs (use blank lines). Customers see this verbatim above the signature box.',
    'legal'
  )
on conflict (key) do nothing;

-- ── 2. Signed-waiver record ─────────────────────────────────────
create table if not exists public.booking_waivers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  signed_name text not null,
  signed_email text not null,
  ip_address text,
  user_agent text,
  -- Snapshot of waiver text + title AT THE MOMENT OF SIGNING.
  -- Critical for legal defensibility if the template is later edited.
  waiver_title_snapshot text not null,
  waiver_text_snapshot text not null,
  signed_at timestamptz not null default now()
);

create index if not exists booking_waivers_booking_idx
  on public.booking_waivers(booking_id);

alter table public.booking_waivers enable row level security;

-- Customers can read their own (matched by booking → customer_email)
drop policy if exists "customer reads own waiver" on public.booking_waivers;
create policy "customer reads own waiver"
  on public.booking_waivers for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_waivers.booking_id
        and lower(b.customer_email) = lower(coalesce(auth.email(), ''))
    )
  );

-- Admin/staff full access
drop policy if exists "staff_or_admin manage waivers" on public.booking_waivers;
create policy "staff_or_admin manage waivers"
  on public.booking_waivers for all
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));
