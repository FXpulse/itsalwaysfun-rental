-- ─────────────────────────────────────────────────────────────────────────
-- MULTI-TENANT FIX — composite unique constraints
-- ─────────────────────────────────────────────────────────────────────────
-- Single-tenant tables had UNIQUE on (slug/key/code) globally. In
-- multi-tenant, the same slug must be allowed across tenants (e.g.,
-- both "bouncedreams" and "partyzone" can have a product slug='castle-bouncer').
--
-- This migration drops the global uniques and replaces them with
-- composite (tenant_id, X) uniques so:
-- 1. Each tenant has its own namespace
-- 2. Seed scripts that use ON CONFLICT (tenant_id, X) work
--
-- Safe to re-run (uses IF EXISTS / IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────

-- Helper: replace a single-column unique/PK with a composite one
do $$
declare
  spec record;
  -- table, column, constraint_pattern
  fix record;
begin
  -- For each (table, scoping_column) pair, drop old unique constraint
  -- (whatever it's named) and add (tenant_id, scoping_column) unique.

  -- site_settings.key
  begin
    alter table public.site_settings drop constraint if exists site_settings_pkey;
    alter table public.site_settings drop constraint if exists site_settings_key_key;
    alter table public.site_settings
      add constraint site_settings_tenant_key_uniq unique (tenant_id, key);
  exception when others then raise notice 'site_settings: %', sqlerrm;
  end;

  -- categories.slug
  begin
    alter table public.categories drop constraint if exists categories_slug_key;
    alter table public.categories
      add constraint categories_tenant_slug_uniq unique (tenant_id, slug);
  exception when others then raise notice 'categories: %', sqlerrm;
  end;

  -- products.slug
  begin
    alter table public.products drop constraint if exists products_slug_key;
    alter table public.products
      add constraint products_tenant_slug_uniq unique (tenant_id, slug);
  exception when others then raise notice 'products: %', sqlerrm;
  end;

  -- packages.slug
  begin
    if to_regclass('public.packages') is not null then
      alter table public.packages drop constraint if exists packages_slug_key;
      alter table public.packages
        add constraint packages_tenant_slug_uniq unique (tenant_id, slug);
    end if;
  exception when others then raise notice 'packages: %', sqlerrm;
  end;

  -- coupons.code
  begin
    if to_regclass('public.coupons') is not null then
      alter table public.coupons drop constraint if exists coupons_code_key;
      alter table public.coupons
        add constraint coupons_tenant_code_uniq unique (tenant_id, code);
    end if;
  exception when others then raise notice 'coupons: %', sqlerrm;
  end;

  -- gift_cards.code
  begin
    if to_regclass('public.gift_cards') is not null then
      alter table public.gift_cards drop constraint if exists gift_cards_code_key;
      alter table public.gift_cards
        add constraint gift_cards_tenant_code_uniq unique (tenant_id, code);
    end if;
  exception when others then raise notice 'gift_cards: %', sqlerrm;
  end;

  -- email_templates.key
  begin
    if to_regclass('public.email_templates') is not null then
      alter table public.email_templates drop constraint if exists email_templates_key_key;
      alter table public.email_templates drop constraint if exists email_templates_pkey;
      alter table public.email_templates
        add constraint email_templates_tenant_key_uniq unique (tenant_id, key);
    end if;
  exception when others then raise notice 'email_templates: %', sqlerrm;
  end;

  -- inventory_categories.name
  begin
    if to_regclass('public.inventory_categories') is not null then
      alter table public.inventory_categories drop constraint if exists inventory_categories_name_key;
      alter table public.inventory_categories
        add constraint inventory_categories_tenant_name_uniq unique (tenant_id, name);
    end if;
  exception when others then raise notice 'inventory_categories: %', sqlerrm;
  end;

  -- faqs — no natural unique, skip
end $$;

notify pgrst, 'reload schema';
