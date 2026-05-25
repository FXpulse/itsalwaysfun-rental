-- Customer reviews — admin-curated testimonials shown on the public site.
-- Admin pastes reviews from Google/Facebook/email and decides which appear.
-- Carousel shows `is_featured` items above the footer; /reviews lists all active.

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_location text,                       -- "Jacksonville, FL"
  review_text text not null check (length(review_text) >= 10),
  rating int not null default 5 check (rating between 1 and 5),
  photo_url text,                                -- optional customer photo / event pic
  source text not null default 'manual'
    check (source in ('google', 'facebook', 'manual', 'yelp', 'instagram', 'email')),
  source_url text,                               -- link to the original (e.g. specific G review)
  is_featured boolean not null default false,    -- appears in homepage carousel
  is_active boolean not null default true,       -- false = hidden everywhere
  sort_order int not null default 100,
  reviewed_at date,                              -- when the review was actually written
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_reviews_active_idx
  on public.customer_reviews(is_active, is_featured desc, sort_order, reviewed_at desc);

create or replace function public.touch_customer_reviews_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists customer_reviews_set_updated_at on public.customer_reviews;
create trigger customer_reviews_set_updated_at
  before update on public.customer_reviews
  for each row execute function public.touch_customer_reviews_updated_at();

alter table public.customer_reviews enable row level security;

drop policy if exists "public reads active reviews" on public.customer_reviews;
create policy "public reads active reviews"
  on public.customer_reviews for select
  using (is_active = true);

drop policy if exists "admin manages reviews" on public.customer_reviews;
create policy "admin manages reviews"
  on public.customer_reviews for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── Settings: where customers can leave a new Google review + carousel toggle
insert into public.site_settings (key, value, description, category) values
  (
    'google_review_url',
    'https://maps.app.goo.gl/yWgQSEfaGv39H7iw6',
    'Link sent to customers in the review-request email + shown as "Leave us a Google review" on the public reviews page.',
    'reviews'
  ),
  (
    'reviews_carousel_enabled',
    'true',
    'Show the customer reviews carousel above the footer on the public homepage.',
    'reviews'
  ),
  (
    'reviews_section_title',
    'What Our Customers Are Saying',
    'Heading shown above the reviews carousel + on the /reviews page.',
    'reviews'
  )
on conflict (key) do nothing;
