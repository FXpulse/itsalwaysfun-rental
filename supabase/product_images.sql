-- Product photo gallery — multiple images per product.
-- The existing products.image_url stays as the "primary" / cover image (shown
-- on cards, in search). This table stores ADDITIONAL gallery photos shown on
-- the product detail page in a carousel.

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  storage_path text,           -- supabase storage path (for deletion); null if URL-only
  alt_text text,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx
  on public.product_images(product_id, is_active, sort_order);

alter table public.product_images enable row level security;

-- Public can read active images (for the public product page)
drop policy if exists "public reads active product images" on public.product_images;
create policy "public reads active product images"
  on public.product_images for select
  using (is_active = true);

-- Admins manage
drop policy if exists "admin manages product images" on public.product_images;
create policy "admin manages product images"
  on public.product_images for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
