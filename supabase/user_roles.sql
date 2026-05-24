-- Phase A: user_roles table for admin/staff role-based access.
--
-- Roles:
--   admin → full access (bookings, products, settings, users, coupons, reports, inventory)
--   staff → bookings + inventory only (no users/coupons/settings/site/categories)
--
-- Run this AFTER an account already exists in auth.users for ludmilayhenry@gmail.com.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff')) default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx on public.user_roles(role);
create index if not exists user_roles_is_active_idx on public.user_roles(is_active);

-- Auto-update updated_at
create or replace function public.touch_user_roles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_roles_set_updated_at on public.user_roles;
create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute function public.touch_user_roles_updated_at();

-- Seed: promote known admin emails (if accounts exist)
insert into public.user_roles (user_id, role, is_active)
select u.id, 'admin', true
from auth.users u
where u.email in ('admin@itsalwaysfun.com', 'ludmilayhenry@gmail.com')
on conflict (user_id) do update set role = 'admin', is_active = true;

-- Helper to check if a user is admin from RLS/server code
create or replace function public.is_admin(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role = 'admin' and is_active = true
  );
$$;

create or replace function public.is_staff_or_admin(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role in ('admin','staff') and is_active = true
  );
$$;

-- RLS: user_roles is admin-only for read/write (no public exposure)
alter table public.user_roles enable row level security;

drop policy if exists "admins can manage roles" on public.user_roles;
create policy "admins can manage roles"
  on public.user_roles
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Allow users to read their own role (so the layout can show "Logged in as staff")
drop policy if exists "users can read own role" on public.user_roles;
create policy "users can read own role"
  on public.user_roles
  for select
  using (auth.uid() = user_id);
