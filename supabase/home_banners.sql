-- Home page banner carousel — rotates images at the top of the home page.
create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  alt_text text,
  link_url text,                     -- optional click-through
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_banners_sort_idx on public.home_banners(sort_order);
create index if not exists home_banners_active_idx on public.home_banners(is_active);

create or replace function public.touch_home_banners_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists home_banners_set_updated_at on public.home_banners;
create trigger home_banners_set_updated_at
  before update on public.home_banners
  for each row execute function public.touch_home_banners_updated_at();

alter table public.home_banners enable row level security;

-- Public read (so home page can fetch with anon key if needed)
drop policy if exists "public can read active banners" on public.home_banners;
create policy "public can read active banners"
  on public.home_banners
  for select
  using (is_active = true);

-- Admin write
drop policy if exists "admin manage banners" on public.home_banners;
create policy "admin manage banners"
  on public.home_banners
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
