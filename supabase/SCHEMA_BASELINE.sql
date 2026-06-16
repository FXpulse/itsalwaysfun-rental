--
-- PostgreSQL database dump
--

\restrict tMhb4e3e8q27m1813qcwKmBQOFb5KOwS1hMNpi5UNQJwyOpMlGJA1CoSUUUMMfU

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: email_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_direction AS ENUM (
    'incoming',
    'outgoing'
);


--
-- Name: ticket_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'open',
    'in_progress',
    'waiting_on_tenant',
    'resolved',
    'closed'
);


--
-- Name: bump_categories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_categories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: bump_coupons_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_coupons_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


--
-- Name: bump_faqs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_faqs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: bump_site_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_site_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select coalesce(
    -- 1. Authenticated path: tenant_id from active user_roles row
    (select tenant_id from public.user_roles
       where user_id = auth.uid()
         and is_active = true
       limit 1),
    -- 2. Anon path: X-Tenant-Id request header (set by Next.js middleware)
    nullif(
      nullif(current_setting('request.headers', true), '')::jsonb->>'x-tenant-id',
      ''
    )::uuid
  );
$$;


--
-- Name: ensure_customer_profile(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_customer_profile(uid uuid, p_tenant_id uuid DEFAULT NULL::uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  existing_code text;
  new_code text;
  effective_tenant uuid;
begin
  if p_tenant_id is null then
    raise warning 'ensure_customer_profile called without p_tenant_id for uid=%; falling back to IAF default. Fix the caller.', uid;
    effective_tenant := '11111111-1111-1111-1111-111111111111'::uuid;
  else
    effective_tenant := p_tenant_id;
  end if;

  select referral_code into existing_code
    from public.customer_profiles
    where user_id = uid;
  if existing_code is not null then
    return existing_code;
  end if;

  new_code := public.generate_referral_code();
  insert into public.customer_profiles (user_id, referral_code, tenant_id)
    values (uid, new_code, effective_tenant)
    on conflict (user_id) do nothing;

  -- Re-read in case of race
  select referral_code into existing_code
    from public.customer_profiles
    where user_id = uid;
  return existing_code;
end;
$$;


--
-- Name: generate_gift_card_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_gift_card_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: generate_inventory_units(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_inventory_units(p_item_id uuid, p_count integer, p_prefix text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
  v_existing_count int;
  v_target_count int;
  v_padding int;
  v_tag text;
  v_inserted int := 0;
  v_tenant_id uuid;
begin
  -- Derive tenant_id from the parent — the child must live in the same tenant.
  select tenant_id into v_tenant_id
    from public.inventory_items
    where id = p_item_id;
  if v_tenant_id is null then
    raise exception 'generate_inventory_units: inventory_item % not found or has no tenant_id', p_item_id;
  end if;

  select count(*) into v_existing_count from public.inventory_units
    where inventory_item_id = p_item_id;

  v_target_count := v_existing_count + p_count;
  v_padding := case when v_target_count >= 100 then 3 else 2 end;

  for i in (v_existing_count + 1)..(v_existing_count + p_count) loop
    v_tag := upper(p_prefix) || '-' || lpad(i::text, v_padding, '0');
    begin
      insert into public.inventory_units (inventory_item_id, tag, tenant_id)
        values (p_item_id, v_tag, v_tenant_id);
      v_inserted := v_inserted + 1;
    exception when unique_violation then
      null;
    end;
  end loop;

  update public.inventory_items
     set tracks_units = true,
         unit_tag_prefix = coalesce(unit_tag_prefix, upper(p_prefix))
   where id = p_item_id;

  return v_inserted;
end;
$$;


--
-- Name: generate_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_referral_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; exists_already boolean;
begin
  loop
    code := '';
    for i in 1..8 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    select exists(select 1 from public.customer_profiles where referral_code = code) into exists_already;
    if not exists_already then return code; end if;
  end loop;
end;
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (select 1 from public.user_roles where user_id = uid and role = 'admin' and is_active = true);
$$;


--
-- Name: is_driver_or_above(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_driver_or_above(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('admin','staff','driver') and is_active = true);
$$;


--
-- Name: is_staff_or_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff_or_admin(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('admin','staff') and is_active = true);
$$;


--
-- Name: is_superadmin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superadmin(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and is_active = true and is_superadmin = true
  );
$$;


--
-- Name: list_tenant_id_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_tenant_id_tables() RETURNS TABLE(table_name text, rls_enabled boolean)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select
    c.table_name::text,
    coalesce(
      (select pt.rowsecurity from pg_tables pt
       where pt.schemaname = 'public' and pt.tablename = c.table_name),
      false
    ) as rls_enabled
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name = 'tenant_id'
  order by c.table_name;
$$;


--
-- Name: new_quote_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.new_quote_token() RETURNS text
    LANGUAGE sql
    AS $$
  select encode(gen_random_bytes(16), 'hex');
$$;


--
-- Name: next_quote_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_quote_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := nullif(current_setting('request.jwt.claims.tenant_id', true), '')::uuid;
  if v_tenant_id is null then
    -- Service-role / no-tenant context: fall back to global counter behavior
    -- but with MAX instead of count to avoid duplicate regeneration on delete
    declare
      y text;
      next_n int;
    begin
      y := to_char(now(), 'YYYY');
      select coalesce(
        max((regexp_replace(quote_number, '^Q-' || y || '-0*', ''))::int),
        0
      ) + 1
      into next_n
      from public.quotes
      where quote_number like 'Q-' || y || '-%';
      return 'Q-' || y || '-' || lpad(next_n::text, 4, '0');
    end;
  end if;
  return public.next_quote_number(v_tenant_id);
end;
$$;


--
-- Name: next_quote_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_quote_number(p_tenant_id uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  y text;
  next_n int;
begin
  y := to_char(now(), 'YYYY');

  -- Extract the numeric suffix from existing quote_numbers for this tenant + year,
  -- find the max, then add 1. Falls back to 1 if no existing quotes.
  select coalesce(
    max(
      (regexp_replace(quote_number, '^Q-' || y || '-0*', ''))::int
    ),
    0
  ) + 1
  into next_n
  from public.quotes
  where tenant_id = p_tenant_id
    and quote_number like 'Q-' || y || '-%';

  return 'Q-' || y || '-' || lpad(next_n::text, 4, '0');
end;
$$;


--
-- Name: seed_default_email_templates(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_email_templates(p_tenant_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  src_tenant_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  inserted int;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;
  if p_tenant_id = src_tenant_id then
    -- nothing to do, this IS the source
    return 0;
  end if;

  insert into public.email_templates
    (tenant_id, key, label, description, subject, email_title,
     body_html, body_text, available_vars, is_active)
  select
    p_tenant_id, key, label, description, subject, email_title,
    body_html, body_text, available_vars, is_active
  from public.email_templates
  where tenant_id = src_tenant_id
  on conflict (tenant_id, key) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;


--
-- Name: seed_default_site_settings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_site_settings(p_tenant_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  inserted int;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  insert into public.site_settings (tenant_id, key, value, description, category) values
    -- ─── GENERAL (business identity + contact) ────────────────────────
    (p_tenant_id, 'business_name', '', 'Your business name (also editable on /admin/settings/branding)', 'general'),
    (p_tenant_id, 'business_phone', '', 'Primary phone shown in header, footer, and emails', 'general'),
    (p_tenant_id, 'business_email', '', 'Primary email shown in footer + emails', 'general'),
    (p_tenant_id, 'business_address', '', 'Street address shown in footer + emails', 'general'),
    (p_tenant_id, 'business_hours', '8:00 AM – 6:00 PM, Monday-Saturday', 'Open hours shown in footer / contact page', 'general'),
    (p_tenant_id, 'service_area', 'Your city and surrounding areas', 'Used in FAQs and contact page', 'general'),
    (p_tenant_id, 'instagram_url', '', 'Instagram profile URL (header + footer icon link)', 'general'),
    (p_tenant_id, 'facebook_url', '', 'Facebook page URL (header + footer icon link)', 'general'),
    (p_tenant_id, 'logo_url', '', 'Public URL of your logo (use /admin/settings/branding to upload)', 'general'),

    -- ─── BOOKING POLICIES ─────────────────────────────────────────────
    (p_tenant_id, 'min_booking_lead_hours', '48', 'Minimum hours before event a customer can still book online. Default 48h.', 'general'),
    (p_tenant_id, 'damage_protection_enabled', 'true', 'Show the damage protection opt-in at checkout', 'general'),
    (p_tenant_id, 'damage_protection_price_cents', '2500', 'Fee in cents customer pays for damage protection ($25 = 2500)', 'general'),
    (p_tenant_id, 'damage_protection_coverage_cents', '50000', 'Max damage covered when customer opts in ($500 = 50000)', 'general'),
    (p_tenant_id, 'booking_terms_note', 'Reschedule up to 7 days before with no fee.', 'Note shown above the booking checkout total', 'general'),

    -- ─── HOMEPAGE CONTENT ─────────────────────────────────────────────
    (p_tenant_id, 'hero_title', 'Rentals delivered to your door', 'Big headline on the homepage hero', 'content'),
    (p_tenant_id, 'hero_subtitle', 'Online booking, setup + takedown included.', 'Sub-headline under hero title', 'content'),
    (p_tenant_id, 'hero_tagline', 'Book now, party tomorrow.', 'Small tagline at top of hero', 'content'),
    (p_tenant_id, 'hero_cta_label', 'Check availability →', 'Text on the main call-to-action button', 'content'),
    (p_tenant_id, 'section_categories_title', 'Browse our rentals', 'Heading above the categories section', 'content'),
    (p_tenant_id, 'section_featured_title', 'Featured rentals', 'Heading above the featured items section', 'content'),
    (p_tenant_id, 'trust_delivery', 'Free Delivery — Within local service area', 'Trust badge 1 (left)', 'content'),
    (p_tenant_id, 'trust_cleaned', 'Cleaned & Sanitized — Every unit, every rental', 'Trust badge 2 (middle)', 'content'),
    (p_tenant_id, 'trust_rating', '5-Star Rated — Trusted by local families', 'Trust badge 3 (right)', 'content'),
    (p_tenant_id, 'footer_description', 'Rentals delivered to your door. Setup, takedown, and clean-up included.', 'Short description shown in the footer', 'content'),

    -- ─── APPEARANCE (colors, fonts) ───────────────────────────────────
    (p_tenant_id, 'hero_bg_color', '', 'Hero background CSS color (empty = use default)', 'appearance'),
    (p_tenant_id, 'hero_text_color', '', 'Hero text CSS color', 'appearance'),
    (p_tenant_id, 'hero_font_family', '', 'Hero font family override', 'appearance'),
    (p_tenant_id, 'categories_bg_color', '', 'Categories section background', 'appearance'),
    (p_tenant_id, 'categories_text_color', '', 'Categories section text color', 'appearance'),
    (p_tenant_id, 'categories_font_family', '', 'Categories font family', 'appearance'),
    (p_tenant_id, 'featured_bg_color', '', 'Featured section background', 'appearance'),
    (p_tenant_id, 'featured_text_color', '', 'Featured section text color', 'appearance'),
    (p_tenant_id, 'featured_font_family', '', 'Featured font family', 'appearance'),
    (p_tenant_id, 'trust_bg_color', '', 'Trust badges section background', 'appearance'),
    (p_tenant_id, 'trust_text_color', '', 'Trust badges section text color', 'appearance'),
    (p_tenant_id, 'trust_font_family', '', 'Trust badges font family', 'appearance'),
    (p_tenant_id, 'footer_bg_color', '', 'Footer background', 'appearance'),
    (p_tenant_id, 'footer_text_color', '', 'Footer text color', 'appearance'),
    (p_tenant_id, 'footer_font_family', '', 'Footer font family', 'appearance'),
    (p_tenant_id, 'site_font_family', 'Quicksand', 'Default site-wide font family', 'appearance'),
    (p_tenant_id, 'site_font_google_url', 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap', 'Google Fonts URL for the site font', 'appearance'),
    (p_tenant_id, 'site_font_self_hosted_url', '', 'Self-hosted font file URL (overrides Google font when set)', 'appearance')
  on conflict (tenant_id, key) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$_$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: touch_coi_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_coi_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_customer_profiles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_customer_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_customer_reviews_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_customer_reviews_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_driver_tax_profiles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_driver_tax_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end $$;


--
-- Name: touch_email_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_email_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_fleet_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_fleet_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_gift_cards_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_gift_cards_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_home_banners_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_home_banners_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_inspection_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_inspection_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_inventory_categories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_inventory_categories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_inventory_units_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_inventory_units_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_inventory_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_inventory_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_overhead_categories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_overhead_categories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


--
-- Name: touch_overhead_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_overhead_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_packages_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_packages_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_product_inv_req_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_product_inv_req_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: touch_quotes_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_quotes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_tenants_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_tenants_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end $$;


--
-- Name: touch_unit_state_after_movement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_unit_state_after_movement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  update public.inventory_units
    set current_state = new.to_state,
        current_booking_id = new.booking_id,
        state_changed_at = new.occurred_at,
        updated_at = now()
    where id = new.inventory_unit_id;
  return new;
end;
$$;


--
-- Name: touch_user_roles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_user_roles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    user_role text,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: blocked_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    blocked_date date NOT NULL,
    reason text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_damages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_damages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    inventory_item_id uuid,
    description text NOT NULL,
    severity text DEFAULT 'minor'::text NOT NULL,
    cost_cents integer DEFAULT 0 NOT NULL,
    customer_responsible boolean DEFAULT false NOT NULL,
    charged_to_customer boolean DEFAULT false NOT NULL,
    photo_url text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by text,
    resolved boolean DEFAULT false NOT NULL,
    notes text,
    covered_by_protection boolean DEFAULT false NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT booking_damages_cost_cents_check CHECK ((cost_cents >= 0)),
    CONSTRAINT booking_damages_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'major'::text])))
);


--
-- Name: booking_emails_sent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_emails_sent (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    email_type text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    resend_id text,
    success boolean DEFAULT true NOT NULL,
    error_message text,
    CONSTRAINT booking_emails_sent_email_type_check CHECK ((email_type = ANY (ARRAY['booking_confirmation'::text, 'booking_reminder_3d'::text, 'booking_review_request'::text, 'booking_anniversary_1y'::text, 'booking_refunded'::text, 'booking_cancelled'::text])))
);


--
-- Name: booking_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    category text NOT NULL,
    description text,
    amount_cents integer NOT NULL,
    driver_hours numeric(6,2),
    driver_email text,
    recorded_by text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT booking_expenses_amount_cents_check CHECK ((amount_cents >= 0)),
    CONSTRAINT booking_expenses_category_check CHECK ((category = ANY (ARRAY['gas'::text, 'payroll'::text, 'tolls'::text, 'consumables'::text, 'damage_repair'::text, 'permit_fee'::text, 'other'::text])))
);


--
-- Name: booking_extensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_extensions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    original_end_date date NOT NULL,
    new_end_date date NOT NULL,
    additional_days integer NOT NULL,
    additional_amount_cents integer NOT NULL,
    stripe_payment_intent_id text,
    stripe_payment_status text DEFAULT 'pending'::text NOT NULL,
    requested_by_email text NOT NULL,
    paid_at timestamp with time zone,
    failed_at timestamp with time zone,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT booking_extensions_additional_amount_cents_check CHECK ((additional_amount_cents >= 0)),
    CONSTRAINT booking_extensions_additional_days_check CHECK ((additional_days > 0)),
    CONSTRAINT booking_extensions_stripe_payment_status_check CHECK ((stripe_payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text])))
);


--
-- Name: booking_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    template_id uuid,
    type text NOT NULL,
    template_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    items_result jsonb DEFAULT '[]'::jsonb NOT NULL,
    inspector_name text,
    inspector_user_id uuid,
    overall_status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_inspections_overall_status_check CHECK ((overall_status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text, 'passed_with_issues'::text]))),
    CONSTRAINT booking_inspections_type_check CHECK ((type = ANY (ARRAY['delivery'::text, 'pickup'::text, 'spot_check'::text])))
);


--
-- Name: booking_internal_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_internal_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    author_user_id uuid,
    author_name text NOT NULL,
    author_role text NOT NULL,
    body text NOT NULL,
    mention_user_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_internal_messages_author_role_check CHECK ((author_role = ANY (ARRAY['admin'::text, 'staff'::text, 'driver'::text, 'system'::text]))),
    CONSTRAINT booking_internal_messages_body_check CHECK (((length(body) > 0) AND (length(body) <= 4000)))
);


--
-- Name: booking_proofs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_proofs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    phase text NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    captured_by text,
    customer_signature_url text,
    customer_signature_name text,
    photos jsonb DEFAULT '[]'::jsonb NOT NULL,
    condition_notes text,
    tenant_id uuid NOT NULL,
    CONSTRAINT booking_proofs_phase_check CHECK ((phase = ANY (ARRAY['delivery'::text, 'pickup'::text])))
);


--
-- Name: booking_waivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_waivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    signed_name text NOT NULL,
    signed_email text NOT NULL,
    ip_address text,
    user_agent text,
    waiver_title_snapshot text NOT NULL,
    waiver_text_snapshot text NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ghl_contact_id text,
    ghl_opportunity_id text,
    customer_first_name text NOT NULL,
    customer_last_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    customer_address text,
    event_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    total_amount integer NOT NULL,
    stripe_payment_intent_id text,
    stripe_payment_status text DEFAULT 'pending'::text NOT NULL,
    booking_status text DEFAULT 'pending_payment'::text NOT NULL,
    hold_expires_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_method text,
    event_end_date date,
    coupon_code text,
    discount_amount integer DEFAULT 0 NOT NULL,
    surface_type text,
    needs_power_supply boolean DEFAULT false NOT NULL,
    power_supply_cents integer DEFAULT 0 NOT NULL,
    customer_confirmed_at timestamp with time zone,
    delivery_checked_at timestamp with time zone,
    delivery_checked_by text,
    addons jsonb DEFAULT '[]'::jsonb NOT NULL,
    addons_total_cents integer DEFAULT 0 NOT NULL,
    damage_protection_purchased boolean DEFAULT false NOT NULL,
    damage_protection_cents integer DEFAULT 0 NOT NULL,
    gift_card_code text,
    gift_card_amount_cents integer DEFAULT 0 NOT NULL,
    cancelled_due_to_weather boolean DEFAULT false NOT NULL,
    tenant_id uuid NOT NULL,
    tax_cents integer DEFAULT 0 NOT NULL,
    CONSTRAINT bookings_booking_status_check CHECK ((booking_status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'delivered'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT bookings_stripe_payment_status_check CHECK ((stripe_payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text, 'failed'::text]))),
    CONSTRAINT bookings_total_amount_check CHECK ((total_amount >= 0))
);


--
-- Name: campaign_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    customer_email text NOT NULL,
    first_name text,
    succeeded boolean DEFAULT false,
    resend_id text,
    error_message text,
    sent_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    filter_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    recipient_count integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    status text DEFAULT 'draft'::text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by_email text,
    scheduled_at timestamp with time zone
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    image_url text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: coi_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coi_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    venue_name text NOT NULL,
    venue_address text,
    additional_insured text,
    special_instructions text,
    requested_by_email text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    coi_file_url text,
    coi_file_path text,
    admin_notes text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_at timestamp with time zone,
    uploaded_by text,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT coi_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'uploaded'::text, 'delivered_to_venue'::text, 'cancelled'::text])))
);


--
-- Name: contact_message_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_message_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    body text NOT NULL,
    sent_by text NOT NULL,
    resend_email_id text,
    send_error text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    message text NOT NULL,
    source text DEFAULT 'website-contact'::text NOT NULL,
    emailed_to_admin_at timestamp with time zone,
    ghl_webhook_fired_at timestamp with time zone,
    ghl_webhook_error text,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email_send_error text,
    subject text,
    tenant_id uuid NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text NOT NULL,
    discount_value integer NOT NULL,
    max_uses integer,
    current_uses integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    referrer_user_id uuid,
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text, 'overnight_free'::text]))),
    CONSTRAINT coupons_discount_value_check CHECK ((discount_value >= 0))
);


--
-- Name: custom_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    definition jsonb NOT NULL,
    is_favorite boolean DEFAULT false,
    last_viewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by_email text
);


--
-- Name: customer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_profiles (
    user_id uuid NOT NULL,
    referral_code text NOT NULL,
    referred_by_user_id uuid,
    loyalty_points integer DEFAULT 0 NOT NULL,
    commission_pending_cents integer DEFAULT 0 NOT NULL,
    commission_paid_cents integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    w9_url text,
    w9_uploaded_at timestamp with time zone,
    w9_tax_year integer,
    tenant_id uuid NOT NULL,
    CONSTRAINT customer_profiles_commission_paid_cents_check CHECK ((commission_paid_cents >= 0)),
    CONSTRAINT customer_profiles_commission_pending_cents_check CHECK ((commission_pending_cents >= 0)),
    CONSTRAINT customer_profiles_loyalty_points_check CHECK ((loyalty_points >= 0))
);


--
-- Name: customer_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_name text NOT NULL,
    customer_location text,
    review_text text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    photo_url text,
    source text DEFAULT 'manual'::text NOT NULL,
    source_url text,
    is_featured boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    reviewed_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT customer_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT customer_reviews_review_text_check CHECK ((length(review_text) >= 10)),
    CONSTRAINT customer_reviews_source_check CHECK ((source = ANY (ARRAY['google'::text, 'facebook'::text, 'manual'::text, 'yelp'::text, 'instagram'::text, 'email'::text])))
);


--
-- Name: customer_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_email text NOT NULL,
    tag_name text NOT NULL,
    tag_color text DEFAULT '#6d28d9'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    created_by_email text
);


--
-- Name: daily_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    insight_date date DEFAULT CURRENT_DATE NOT NULL,
    whats_working text,
    needs_attention text,
    today_focus text,
    raw_content text,
    generated_at timestamp with time zone DEFAULT now()
);


--
-- Name: dispatch_route_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_route_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by text,
    returned_at timestamp with time zone,
    return_condition text,
    return_note text,
    CONSTRAINT dispatch_route_units_return_condition_check CHECK (((return_condition IS NULL) OR (return_condition = ANY (ARRAY['good'::text, 'needs_repair'::text, 'broken'::text]))))
);


--
-- Name: dispatch_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_date date NOT NULL,
    vehicle_id uuid NOT NULL,
    trailer_id uuid,
    driver_name text,
    notes text,
    status text DEFAULT 'planned'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    route_type text DEFAULT 'delivery'::text NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT dispatch_routes_route_type_check CHECK ((route_type = ANY (ARRAY['delivery'::text, 'pickup'::text]))),
    CONSTRAINT dispatch_routes_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'loaded'::text, 'out'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: dispatch_stops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    stop_order integer DEFAULT 0 NOT NULL,
    notes text,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: driver_tax_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_tax_profiles (
    driver_email text NOT NULL,
    full_name text,
    business_name text,
    tin_last4 text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    w9_storage_path text,
    w9_received_at timestamp with time zone,
    w9_tax_year integer,
    filed_history jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT driver_tax_profiles_tin_last4_check CHECK (((tin_last4 IS NULL) OR (tin_last4 ~ '^\d{4}$'::text)))
);


--
-- Name: email_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand text NOT NULL,
    label text NOT NULL,
    email_address text NOT NULL,
    imap_host text NOT NULL,
    imap_port integer DEFAULT 993 NOT NULL,
    imap_tls boolean DEFAULT true NOT NULL,
    smtp_host text NOT NULL,
    smtp_port integer DEFAULT 465 NOT NULL,
    smtp_tls boolean DEFAULT true NOT NULL,
    username text NOT NULL,
    encrypted_password text NOT NULL,
    last_sync_at timestamp with time zone,
    last_synced_uid_per_folder jsonb DEFAULT '{}'::jsonb,
    last_sync_error text,
    last_sync_error_at timestamp with time zone,
    consecutive_failures integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    action text NOT NULL,
    details_jsonb jsonb,
    user_email text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    path text NOT NULL,
    name text NOT NULL,
    special_use text,
    is_active boolean DEFAULT true,
    unread_count integer DEFAULT 0,
    message_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6b7280'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    account_id uuid NOT NULL,
    folder_id uuid,
    direction public.email_direction NOT NULL,
    imap_uid integer,
    message_id_header text,
    in_reply_to text,
    from_address text NOT NULL,
    to_addresses jsonb DEFAULT '[]'::jsonb NOT NULL,
    cc_addresses jsonb DEFAULT '[]'::jsonb,
    subject text,
    body_text text,
    body_html text,
    received_at timestamp with time zone,
    sent_at timestamp with time zone,
    is_read boolean DEFAULT false,
    has_attachments boolean DEFAULT false,
    raw_size_bytes integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    name text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    condition_jsonb jsonb NOT NULL,
    action_jsonb jsonb NOT NULL,
    is_active boolean DEFAULT true,
    last_run_at timestamp with time zone,
    match_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    description text,
    subject text NOT NULL,
    email_title text NOT NULL,
    body_html text NOT NULL,
    body_text text NOT NULL,
    available_vars text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    sms_body text
);


--
-- Name: email_thread_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_thread_labels (
    thread_id uuid NOT NULL,
    label_id uuid NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    folder_id uuid,
    subject text,
    participants jsonb DEFAULT '[]'::jsonb NOT NULL,
    message_count integer DEFAULT 0,
    unread_count integer DEFAULT 0,
    last_message_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: gift_card_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_card_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amount_cents integer NOT NULL,
    purchaser_name text NOT NULL,
    purchaser_email text NOT NULL,
    recipient_name text,
    recipient_email text NOT NULL,
    message text,
    deliver_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    stripe_payment_intent_id text,
    gift_card_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    failed_at timestamp with time zone,
    failure_reason text,
    tenant_id uuid NOT NULL,
    recipient_phone text,
    CONSTRAINT gift_card_purchases_amount_cents_check CHECK (((amount_cents >= 1000) AND (amount_cents <= 1000000))),
    CONSTRAINT gift_card_purchases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: gift_card_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_card_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gift_card_id uuid NOT NULL,
    booking_id uuid,
    amount_cents integer NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT gift_card_redemptions_amount_cents_check CHECK ((amount_cents > 0))
);


--
-- Name: gift_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    original_amount_cents integer NOT NULL,
    balance_cents integer NOT NULL,
    purchaser_email text,
    purchaser_name text,
    recipient_email text NOT NULL,
    recipient_name text,
    message text,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    sent_to_recipient_at timestamp with time zone,
    fully_redeemed_at timestamp with time zone,
    stripe_payment_intent_id text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT gift_cards_balance_cents_check CHECK ((balance_cents >= 0)),
    CONSTRAINT gift_cards_original_amount_cents_check CHECK ((original_amount_cents > 0))
);


--
-- Name: google_business_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_business_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    google_email text,
    location_id text,
    location_name text,
    location_address text,
    access_token text NOT NULL,
    access_token_expires_at timestamp with time zone NOT NULL,
    refresh_token text NOT NULL,
    scopes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sync_at timestamp with time zone,
    last_sync_status text,
    last_sync_error text
);


--
-- Name: google_business_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_business_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    gbp_post_name text,
    topic_type text NOT NULL,
    summary text NOT NULL,
    call_to_action_type text,
    call_to_action_url text,
    media_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    posted_at timestamp with time zone,
    failed_reason text,
    created_by_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: google_business_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_business_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    gbp_review_name text NOT NULL,
    reviewer_display_name text,
    reviewer_photo_url text,
    star_rating integer,
    comment text,
    reviewed_at timestamp with time zone,
    reply_comment text,
    reply_updated_at timestamp with time zone,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT google_business_reviews_star_rating_check CHECK (((star_rating >= 1) AND (star_rating <= 5)))
);


--
-- Name: google_places_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_places_cache (
    tenant_id uuid NOT NULL,
    source_url text,
    place_id text,
    display_name text,
    formatted_address text,
    rating numeric(3,2),
    user_rating_count integer,
    reviews jsonb DEFAULT '[]'::jsonb NOT NULL,
    google_maps_uri text,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sync_status text DEFAULT 'ok'::text,
    last_sync_error text
);


--
-- Name: home_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    image_url text NOT NULL,
    alt_text text,
    link_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: inspection_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    product_id uuid,
    category_id uuid,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    description text,
    quantity_owned integer DEFAULT 1 NOT NULL,
    quantity_in_use integer DEFAULT 0 NOT NULL,
    location text,
    condition text DEFAULT 'good'::text NOT NULL,
    purchase_date date,
    purchase_cost_cents integer DEFAULT 0,
    last_maintenance_date date,
    maintenance_notes text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tracks_units boolean DEFAULT false NOT NULL,
    unit_tag_prefix text,
    low_stock_threshold integer DEFAULT 0 NOT NULL,
    low_stock_alerted_at timestamp with time zone,
    tenant_id uuid NOT NULL,
    CONSTRAINT inventory_items_condition_check CHECK ((condition = ANY (ARRAY['good'::text, 'needs_repair'::text, 'broken'::text, 'retired'::text]))),
    CONSTRAINT inventory_items_low_stock_threshold_check CHECK ((low_stock_threshold >= 0)),
    CONSTRAINT inventory_items_purchase_cost_cents_check CHECK ((purchase_cost_cents >= 0)),
    CONSTRAINT inventory_items_quantity_in_use_check CHECK ((quantity_in_use >= 0)),
    CONSTRAINT inventory_items_quantity_owned_check CHECK ((quantity_owned >= 0))
);


--
-- Name: inventory_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_item_id uuid NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    cost_cents integer DEFAULT 0 NOT NULL,
    performed_by text,
    performed_at date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_maintenance_cost_cents_check CHECK ((cost_cents >= 0)),
    CONSTRAINT inventory_maintenance_type_check CHECK ((type = ANY (ARRAY['cleaning'::text, 'repair'::text, 'inspection'::text, 'replacement'::text, 'other'::text])))
);


--
-- Name: inventory_unit_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_unit_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    inventory_unit_id uuid NOT NULL,
    to_state text NOT NULL,
    from_state text,
    booking_id uuid,
    route_id uuid,
    performed_by_user_id uuid,
    performed_by_name text,
    notes text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_unit_movements_to_state_check CHECK ((to_state = ANY (ARRAY['warehouse'::text, 'loading'::text, 'on_truck'::text, 'at_customer'::text, 'returning'::text, 'maintenance'::text, 'retired'::text])))
);


--
-- Name: inventory_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_item_id uuid NOT NULL,
    tag text NOT NULL,
    serial_number text,
    condition text DEFAULT 'good'::text NOT NULL,
    notes text,
    acquired_date date,
    retired_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    current_state text DEFAULT 'warehouse'::text NOT NULL,
    current_booking_id uuid,
    state_changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_units_condition_check CHECK ((condition = ANY (ARRAY['good'::text, 'needs_repair'::text, 'broken'::text, 'retired'::text]))),
    CONSTRAINT inventory_units_current_state_check CHECK ((current_state = ANY (ARRAY['warehouse'::text, 'loading'::text, 'on_truck'::text, 'at_customer'::text, 'returning'::text, 'maintenance'::text, 'retired'::text])))
);


--
-- Name: kb_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    body_md text NOT NULL,
    category text,
    tags text[] DEFAULT '{}'::text[],
    is_published boolean DEFAULT true,
    view_count integer DEFAULT 0,
    helpful_count integer DEFAULT 0,
    unhelpful_count integer DEFAULT 0,
    ai_resolved_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: lead_magnet_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_magnet_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    tool_name text NOT NULL,
    source text,
    payload_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    marketing_opt_in boolean DEFAULT false,
    ghl_synced_at timestamp with time zone,
    ghl_contact_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    commission_cents integer DEFAULT 0 NOT NULL,
    booking_id uuid,
    referred_user_id uuid,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT loyalty_transactions_type_check CHECK ((type = ANY (ARRAY['booking_points'::text, 'referral_commission'::text, 'points_redeemed'::text, 'commission_payout'::text, 'admin_adjustment'::text])))
);


--
-- Name: overhead_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overhead_categories (
    key text NOT NULL,
    label text NOT NULL,
    group_name text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: overhead_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overhead_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    monthly_cents integer NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    effective_to date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT overhead_costs_monthly_cents_check CHECK ((monthly_cents >= 0))
);


--
-- Name: packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    price_cents integer NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT packages_price_cents_check CHECK ((price_cents >= 0))
);


--
-- Name: payout_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount_cents integer NOT NULL,
    payout_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    w9_url text,
    linked_gift_card_id uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    approved_by text,
    processed_at timestamp with time zone,
    rejected_at timestamp with time zone,
    rejected_reason text,
    customer_notes text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT payout_requests_amount_cents_check CHECK ((amount_cents > 0)),
    CONSTRAINT payout_requests_payout_type_check CHECK ((payout_type = ANY (ARRAY['stripe'::text, 'credit'::text]))),
    CONSTRAINT payout_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'processed'::text, 'cancelled'::text])))
);


--
-- Name: portal_otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_otp_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    tenant_id uuid,
    code_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    category text NOT NULL,
    price_per_day integer NOT NULL,
    stock integer DEFAULT 1 NOT NULL,
    image_url text,
    ghl_listing_id text,
    is_active boolean DEFAULT true NOT NULL,
    setup_area text,
    actual_size text,
    outlets_required integer DEFAULT 1,
    age_group text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_cents integer DEFAULT 0 NOT NULL,
    is_addon boolean DEFAULT false NOT NULL,
    weekend_price_per_day integer,
    tenant_id uuid NOT NULL,
    tax_exempt boolean DEFAULT false NOT NULL,
    CONSTRAINT products_cost_cents_check CHECK ((cost_cents >= 0)),
    CONSTRAINT products_price_per_day_check CHECK ((price_per_day >= 0)),
    CONSTRAINT products_stock_check CHECK ((stock >= 0))
);


--
-- Name: COLUMN products.cost_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.cost_cents IS 'Internal: what the product cost to acquire. Used for margin/ROI analysis. NEVER exposed to public.';


--
-- Name: product_availability; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.product_availability AS
 SELECT p.id AS product_id,
    p.slug,
    p.name,
    p.stock,
    COALESCE(b.booked_count, (0)::bigint) AS booked_count,
    COALESCE(bd.blocked_count, (0)::bigint) AS blocked_count
   FROM ((public.products p
     LEFT JOIN LATERAL ( SELECT count(*) AS booked_count
           FROM public.bookings
          WHERE ((bookings.product_id = p.id) AND (bookings.booking_status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'delivered'::text])) AND (bookings.event_date = CURRENT_DATE))) b ON (true))
     LEFT JOIN LATERAL ( SELECT count(*) AS blocked_count
           FROM public.blocked_dates
          WHERE ((blocked_dates.product_id = p.id) AND (blocked_dates.blocked_date = CURRENT_DATE))) bd ON (true))
  WHERE (p.is_active = true);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    image_url text NOT NULL,
    storage_path text,
    alt_text text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: product_inventory_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_inventory_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    surface_types text[],
    only_when_needs_power boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    per_day boolean DEFAULT false NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT product_inventory_requirements_quantity_check CHECK ((quantity > 0))
);


--
-- Name: COLUMN product_inventory_requirements.per_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_inventory_requirements.per_day IS 'If true, the checklist multiplies quantity by the number of rental days. Use for consumables (propane, fuel, ice).';


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_number text NOT NULL,
    token text NOT NULL,
    customer_first_name text NOT NULL,
    customer_last_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    customer_address text,
    event_date date NOT NULL,
    event_end_date date,
    start_time time without time zone,
    end_time time without time zone,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal_cents integer DEFAULT 0 NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    discount_note text,
    tax_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    customer_message text,
    internal_notes text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    approved_at timestamp with time zone,
    declined_at timestamp with time zone,
    decline_reason text,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
    converted_booking_id uuid,
    created_by uuid,
    customer_company text,
    followup_sent_at timestamp with time zone,
    tenant_id uuid NOT NULL,
    damage_protection_offered boolean DEFAULT false,
    damage_protection_cents integer DEFAULT 0,
    damage_protection_accepted boolean,
    waiver_required boolean DEFAULT true,
    waiver_signed_name text,
    waiver_signed_at timestamp with time zone,
    surface_type text,
    needs_power_supply boolean,
    hold_reminder_sent_at timestamp with time zone,
    tax_exempt boolean DEFAULT false NOT NULL,
    tax_manual_override boolean DEFAULT false NOT NULL,
    CONSTRAINT quotes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'viewed'::text, 'approved'::text, 'declined'::text, 'expired'::text, 'converted'::text])))
);


--
-- Name: setup_surfaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setup_surfaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value text,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    tenant_id uuid NOT NULL
);


--
-- Name: superadmin_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.superadmin_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric text NOT NULL,
    target numeric NOT NULL,
    target_date date NOT NULL,
    label text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    achieved_at timestamp with time zone
);


--
-- Name: support_ticket_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    author_email text NOT NULL,
    author_kind text NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    tenant_business_name text,
    tenant_owner_email text,
    subject text NOT NULL,
    body text NOT NULL,
    category text,
    priority public.ticket_priority DEFAULT 'normal'::public.ticket_priority NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    ai_category text,
    ai_priority text,
    ai_suggested_article_id uuid,
    ai_suggested_response text,
    ai_confidence numeric(3,2),
    ai_processed_at timestamp with time zone,
    resolved_at timestamp with time zone,
    resolved_by_email text,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenant_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    last_used_at timestamp with time zone,
    last_used_ip text,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_reason text,
    created_at timestamp with time zone DEFAULT now(),
    created_by_email text
);


--
-- Name: tenant_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    metric text NOT NULL,
    target numeric NOT NULL,
    target_date date NOT NULL,
    label text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    achieved_at timestamp with time zone
);


--
-- Name: tenant_home_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_home_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    section_type text NOT NULL,
    is_enabled boolean DEFAULT true,
    display_order integer DEFAULT 100,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenant_onboarding_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_onboarding_checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    item_key text NOT NULL,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    completed_by_email text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenant_operator_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_operator_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    note_type text NOT NULL,
    subject text,
    body text NOT NULL,
    follow_up_date date,
    is_resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by_email text
);


--
-- Name: tenant_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_profile (
    tenant_id uuid NOT NULL,
    industry text,
    employees_count integer,
    year_founded integer,
    market_size text,
    primary_goal text,
    pain_points text,
    bookings_per_month_avg integer,
    revenue_tier text,
    decision_maker_name text,
    decision_maker_phone text,
    decision_maker_role text,
    acquisition_source text,
    account_status text DEFAULT 'prospect'::text,
    notes text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by_email text
);


--
-- Name: tenant_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    events text[] DEFAULT '{}'::text[] NOT NULL,
    secret text NOT NULL,
    is_active boolean DEFAULT true,
    last_delivery_at timestamp with time zone,
    last_delivery_status integer,
    total_deliveries integer DEFAULT 0,
    failed_deliveries integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    created_by_email text
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    business_name text NOT NULL,
    owner_email text NOT NULL,
    owner_phone text,
    plan text DEFAULT 'starter'::text NOT NULL,
    stripe_account_id text,
    stripe_account_status text,
    custom_domain text,
    branding jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_ends_at timestamp with time zone,
    suspended_at timestamp with time zone,
    suspended_reason text,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    onboarding_completed_at timestamp with time zone,
    dunning_started_at timestamp with time zone,
    dunning_emails_sent jsonb DEFAULT '[]'::jsonb,
    dunning_last_action_at timestamp with time zone,
    dunning_recovered_at timestamp with time zone,
    onboarding_nudges_sent jsonb DEFAULT '[]'::jsonb,
    onboarding_last_nudge_at timestamp with time zone,
    calendar_feed_token text,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    notification_email text,
    inbox_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT tenants_plan_check CHECK ((plan = ANY (ARRAY['starter'::text, 'pro'::text, 'enterprise'::text, 'founder'::text]))),
    CONSTRAINT tenants_slug_check CHECK (((slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'::text) AND (length(slug) >= 2) AND (length(slug) <= 60))),
    CONSTRAINT tenants_subscription_status_check CHECK (((subscription_status IS NULL) OR (subscription_status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'incomplete'::text, 'incomplete_expired'::text, 'unpaid'::text, 'paused'::text]))))
);


--
-- Name: trailers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trailers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    capacity_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vin text,
    license_tag text,
    compatible_inventory_item_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: COLUMN trailers.compatible_inventory_item_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trailers.compatible_inventory_item_ids IS 'Same as vehicles.compatible_inventory_item_ids — for trailers.';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_superadmin boolean DEFAULT false NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'driver'::text])))
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    vehicle_type text DEFAULT 'truck'::text NOT NULL,
    requires_trailer boolean DEFAULT true NOT NULL,
    capacity_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vin text,
    license_tag text,
    compatible_inventory_item_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    tenant_id uuid NOT NULL,
    CONSTRAINT vehicles_vehicle_type_check CHECK ((vehicle_type = ANY (ARRAY['truck'::text, 'van'::text, 'pickup'::text, 'other'::text])))
);


--
-- Name: COLUMN vehicles.compatible_inventory_item_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vehicles.compatible_inventory_item_ids IS 'List of inventory_items.id that this vehicle can mount/carry (e.g. electric dolly, ramps). Used at dispatch time to warn about mismatches.';


--
-- Name: webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_id uuid NOT NULL,
    event text NOT NULL,
    payload jsonb NOT NULL,
    response_status integer,
    response_body text,
    attempt_count integer DEFAULT 1,
    succeeded boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    next_retry_at timestamp with time zone,
    max_attempts integer DEFAULT 4
);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: blocked_dates blocked_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_dates
    ADD CONSTRAINT blocked_dates_pkey PRIMARY KEY (id);


--
-- Name: blocked_dates blocked_dates_product_id_blocked_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_dates
    ADD CONSTRAINT blocked_dates_product_id_blocked_date_key UNIQUE (product_id, blocked_date);


--
-- Name: booking_damages booking_damages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_damages
    ADD CONSTRAINT booking_damages_pkey PRIMARY KEY (id);


--
-- Name: booking_emails_sent booking_emails_sent_booking_id_email_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_emails_sent
    ADD CONSTRAINT booking_emails_sent_booking_id_email_type_key UNIQUE (booking_id, email_type);


--
-- Name: booking_emails_sent booking_emails_sent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_emails_sent
    ADD CONSTRAINT booking_emails_sent_pkey PRIMARY KEY (id);


--
-- Name: booking_expenses booking_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_expenses
    ADD CONSTRAINT booking_expenses_pkey PRIMARY KEY (id);


--
-- Name: booking_extensions booking_extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_extensions
    ADD CONSTRAINT booking_extensions_pkey PRIMARY KEY (id);


--
-- Name: booking_extensions booking_extensions_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_extensions
    ADD CONSTRAINT booking_extensions_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: booking_inspections booking_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_inspections
    ADD CONSTRAINT booking_inspections_pkey PRIMARY KEY (id);


--
-- Name: booking_internal_messages booking_internal_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_internal_messages
    ADD CONSTRAINT booking_internal_messages_pkey PRIMARY KEY (id);


--
-- Name: booking_proofs booking_proofs_booking_id_phase_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_proofs
    ADD CONSTRAINT booking_proofs_booking_id_phase_key UNIQUE (booking_id, phase);


--
-- Name: booking_proofs booking_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_proofs
    ADD CONSTRAINT booking_proofs_pkey PRIMARY KEY (id);


--
-- Name: booking_waivers booking_waivers_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waivers
    ADD CONSTRAINT booking_waivers_booking_id_key UNIQUE (booking_id);


--
-- Name: booking_waivers booking_waivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waivers
    ADD CONSTRAINT booking_waivers_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: campaign_recipients campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_tenant_slug_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_tenant_slug_uniq UNIQUE (tenant_id, slug);


--
-- Name: coi_requests coi_requests_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coi_requests
    ADD CONSTRAINT coi_requests_booking_id_key UNIQUE (booking_id);


--
-- Name: coi_requests coi_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coi_requests
    ADD CONSTRAINT coi_requests_pkey PRIMARY KEY (id);


--
-- Name: contact_message_replies contact_message_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_message_replies
    ADD CONSTRAINT contact_message_replies_pkey PRIMARY KEY (id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_tenant_code_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_tenant_code_uniq UNIQUE (tenant_id, code);


--
-- Name: custom_reports custom_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_pkey PRIMARY KEY (id);


--
-- Name: customer_profiles customer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: customer_profiles customer_profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: customer_reviews customer_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews
    ADD CONSTRAINT customer_reviews_pkey PRIMARY KEY (id);


--
-- Name: customer_tags customer_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT customer_tags_pkey PRIMARY KEY (id);


--
-- Name: customer_tags customer_tags_tenant_id_customer_email_tag_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT customer_tags_tenant_id_customer_email_tag_name_key UNIQUE (tenant_id, customer_email, tag_name);


--
-- Name: daily_insights daily_insights_insight_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_insights
    ADD CONSTRAINT daily_insights_insight_date_key UNIQUE (insight_date);


--
-- Name: daily_insights daily_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_insights
    ADD CONSTRAINT daily_insights_pkey PRIMARY KEY (id);


--
-- Name: dispatch_route_units dispatch_route_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_route_units
    ADD CONSTRAINT dispatch_route_units_pkey PRIMARY KEY (id);


--
-- Name: dispatch_route_units dispatch_route_units_route_id_unit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_route_units
    ADD CONSTRAINT dispatch_route_units_route_id_unit_id_key UNIQUE (route_id, unit_id);


--
-- Name: dispatch_routes dispatch_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_routes
    ADD CONSTRAINT dispatch_routes_pkey PRIMARY KEY (id);


--
-- Name: dispatch_stops dispatch_stops_booking_route_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_stops
    ADD CONSTRAINT dispatch_stops_booking_route_key UNIQUE (booking_id, route_id);


--
-- Name: dispatch_stops dispatch_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_stops
    ADD CONSTRAINT dispatch_stops_pkey PRIMARY KEY (id);


--
-- Name: driver_tax_profiles driver_tax_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_tax_profiles
    ADD CONSTRAINT driver_tax_profiles_pkey PRIMARY KEY (driver_email);


--
-- Name: email_accounts email_accounts_email_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_email_address_key UNIQUE (email_address);


--
-- Name: email_accounts email_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_pkey PRIMARY KEY (id);


--
-- Name: email_audit_log email_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_audit_log
    ADD CONSTRAINT email_audit_log_pkey PRIMARY KEY (id);


--
-- Name: email_folders email_folders_account_id_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_folders
    ADD CONSTRAINT email_folders_account_id_path_key UNIQUE (account_id, path);


--
-- Name: email_folders email_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_folders
    ADD CONSTRAINT email_folders_pkey PRIMARY KEY (id);


--
-- Name: email_labels email_labels_account_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_labels
    ADD CONSTRAINT email_labels_account_id_name_key UNIQUE (account_id, name);


--
-- Name: email_labels email_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_labels
    ADD CONSTRAINT email_labels_pkey PRIMARY KEY (id);


--
-- Name: email_messages email_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_pkey PRIMARY KEY (id);


--
-- Name: email_rules email_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_rules
    ADD CONSTRAINT email_rules_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_tenant_key_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_tenant_key_uniq UNIQUE (tenant_id, key);


--
-- Name: email_thread_labels email_thread_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_thread_labels
    ADD CONSTRAINT email_thread_labels_pkey PRIMARY KEY (thread_id, label_id);


--
-- Name: email_threads email_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_pkey PRIMARY KEY (id);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: gift_card_purchases gift_card_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_purchases
    ADD CONSTRAINT gift_card_purchases_pkey PRIMARY KEY (id);


--
-- Name: gift_card_purchases gift_card_purchases_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_purchases
    ADD CONSTRAINT gift_card_purchases_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: gift_card_redemptions gift_card_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_redemptions
    ADD CONSTRAINT gift_card_redemptions_pkey PRIMARY KEY (id);


--
-- Name: gift_cards gift_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_pkey PRIMARY KEY (id);


--
-- Name: gift_cards gift_cards_tenant_code_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_tenant_code_uniq UNIQUE (tenant_id, code);


--
-- Name: google_business_connections google_business_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_business_connections
    ADD CONSTRAINT google_business_connections_pkey PRIMARY KEY (id);


--
-- Name: google_business_connections google_business_connections_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_business_connections
    ADD CONSTRAINT google_business_connections_tenant_id_key UNIQUE (tenant_id);


--
-- Name: google_business_posts google_business_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_business_posts
    ADD CONSTRAINT google_business_posts_pkey PRIMARY KEY (id);


--
-- Name: google_business_reviews google_business_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_business_reviews
    ADD CONSTRAINT google_business_reviews_pkey PRIMARY KEY (id);


--
-- Name: google_business_reviews google_business_reviews_tenant_id_gbp_review_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_business_reviews
    ADD CONSTRAINT google_business_reviews_tenant_id_gbp_review_name_key UNIQUE (tenant_id, gbp_review_name);


--
-- Name: google_places_cache google_places_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_places_cache
    ADD CONSTRAINT google_places_cache_pkey PRIMARY KEY (tenant_id);


--
-- Name: home_banners home_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_banners
    ADD CONSTRAINT home_banners_pkey PRIMARY KEY (id);


--
-- Name: inspection_templates inspection_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_templates
    ADD CONSTRAINT inspection_templates_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_tenant_name_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_tenant_name_uniq UNIQUE (tenant_id, name);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_maintenance inventory_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_maintenance
    ADD CONSTRAINT inventory_maintenance_pkey PRIMARY KEY (id);


--
-- Name: inventory_unit_movements inventory_unit_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_movements
    ADD CONSTRAINT inventory_unit_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_units inventory_units_inventory_item_id_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_units
    ADD CONSTRAINT inventory_units_inventory_item_id_tag_key UNIQUE (inventory_item_id, tag);


--
-- Name: inventory_units inventory_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_units
    ADD CONSTRAINT inventory_units_pkey PRIMARY KEY (id);


--
-- Name: kb_articles kb_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_articles
    ADD CONSTRAINT kb_articles_pkey PRIMARY KEY (id);


--
-- Name: kb_articles kb_articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_articles
    ADD CONSTRAINT kb_articles_slug_key UNIQUE (slug);


--
-- Name: lead_magnet_signups lead_magnet_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_magnet_signups
    ADD CONSTRAINT lead_magnet_signups_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: overhead_categories overhead_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overhead_categories
    ADD CONSTRAINT overhead_categories_pkey PRIMARY KEY (key);


--
-- Name: overhead_costs overhead_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overhead_costs
    ADD CONSTRAINT overhead_costs_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: packages packages_tenant_slug_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_tenant_slug_uniq UNIQUE (tenant_id, slug);


--
-- Name: payout_requests payout_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT payout_requests_pkey PRIMARY KEY (id);


--
-- Name: portal_otp_codes portal_otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_otp_codes
    ADD CONSTRAINT portal_otp_codes_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_inventory_requirements product_inventory_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inventory_requirements
    ADD CONSTRAINT product_inventory_requirements_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_tenant_slug_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_slug_uniq UNIQUE (tenant_id, slug);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_tenant_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_tenant_quote_number_key UNIQUE (tenant_id, quote_number);


--
-- Name: quotes quotes_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_token_key UNIQUE (token);


--
-- Name: setup_surfaces setup_surfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setup_surfaces
    ADD CONSTRAINT setup_surfaces_pkey PRIMARY KEY (id);


--
-- Name: setup_surfaces setup_surfaces_tenant_id_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setup_surfaces
    ADD CONSTRAINT setup_surfaces_tenant_id_value_key UNIQUE (tenant_id, value);


--
-- Name: site_settings site_settings_tenant_key_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_tenant_key_uniq UNIQUE (tenant_id, key);


--
-- Name: superadmin_goals superadmin_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superadmin_goals
    ADD CONSTRAINT superadmin_goals_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_replies support_ticket_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_replies
    ADD CONSTRAINT support_ticket_replies_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: tenant_api_keys tenant_api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: tenant_api_keys tenant_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_pkey PRIMARY KEY (id);


--
-- Name: tenant_goals tenant_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_goals
    ADD CONSTRAINT tenant_goals_pkey PRIMARY KEY (id);


--
-- Name: tenant_home_sections tenant_home_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_home_sections
    ADD CONSTRAINT tenant_home_sections_pkey PRIMARY KEY (id);


--
-- Name: tenant_home_sections tenant_home_sections_tenant_id_section_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_home_sections
    ADD CONSTRAINT tenant_home_sections_tenant_id_section_type_key UNIQUE (tenant_id, section_type);


--
-- Name: tenant_onboarding_checklist tenant_onboarding_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_onboarding_checklist
    ADD CONSTRAINT tenant_onboarding_checklist_pkey PRIMARY KEY (id);


--
-- Name: tenant_onboarding_checklist tenant_onboarding_checklist_tenant_id_item_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_onboarding_checklist
    ADD CONSTRAINT tenant_onboarding_checklist_tenant_id_item_key_key UNIQUE (tenant_id, item_key);


--
-- Name: tenant_operator_notes tenant_operator_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_operator_notes
    ADD CONSTRAINT tenant_operator_notes_pkey PRIMARY KEY (id);


--
-- Name: tenant_profile tenant_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_profile
    ADD CONSTRAINT tenant_profile_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_webhooks tenant_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_webhooks
    ADD CONSTRAINT tenant_webhooks_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_custom_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_custom_domain_key UNIQUE (custom_domain);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: trailers trailers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trailers
    ADD CONSTRAINT trailers_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_action_idx ON public.admin_audit_log USING btree (action, created_at DESC);


--
-- Name: admin_audit_log_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log USING btree (created_at DESC);


--
-- Name: admin_audit_log_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_entity_idx ON public.admin_audit_log USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: admin_audit_log_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_tenant_id_idx ON public.admin_audit_log USING btree (tenant_id);


--
-- Name: admin_audit_log_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_log_user_idx ON public.admin_audit_log USING btree (user_email, created_at DESC);


--
-- Name: booking_damages_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_damages_booking_idx ON public.booking_damages USING btree (booking_id);


--
-- Name: booking_damages_inventory_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_damages_inventory_idx ON public.booking_damages USING btree (inventory_item_id);


--
-- Name: booking_damages_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_damages_tenant_id_idx ON public.booking_damages USING btree (tenant_id);


--
-- Name: booking_damages_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_damages_unresolved_idx ON public.booking_damages USING btree (resolved) WHERE (resolved = false);


--
-- Name: booking_emails_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_emails_booking_idx ON public.booking_emails_sent USING btree (booking_id);


--
-- Name: booking_emails_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_emails_type_idx ON public.booking_emails_sent USING btree (email_type);


--
-- Name: booking_expenses_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_expenses_booking_idx ON public.booking_expenses USING btree (booking_id, recorded_at DESC);


--
-- Name: booking_expenses_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_expenses_category_idx ON public.booking_expenses USING btree (category, recorded_at DESC);


--
-- Name: booking_expenses_driver_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_expenses_driver_idx ON public.booking_expenses USING btree (driver_email, recorded_at DESC) WHERE (driver_email IS NOT NULL);


--
-- Name: booking_expenses_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_expenses_period_idx ON public.booking_expenses USING btree (recorded_at DESC);


--
-- Name: booking_expenses_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_expenses_tenant_id_idx ON public.booking_expenses USING btree (tenant_id);


--
-- Name: booking_extensions_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_extensions_booking_idx ON public.booking_extensions USING btree (booking_id, created_at DESC);


--
-- Name: booking_extensions_pi_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_extensions_pi_idx ON public.booking_extensions USING btree (stripe_payment_intent_id);


--
-- Name: booking_extensions_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_extensions_tenant_id_idx ON public.booking_extensions USING btree (tenant_id);


--
-- Name: booking_inspections_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_inspections_booking_idx ON public.booking_inspections USING btree (booking_id, type, performed_at DESC);


--
-- Name: booking_inspections_failed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_inspections_failed_idx ON public.booking_inspections USING btree (tenant_id, overall_status) WHERE (overall_status = ANY (ARRAY['failed'::text, 'passed_with_issues'::text]));


--
-- Name: booking_inspections_tenant_perf_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_inspections_tenant_perf_idx ON public.booking_inspections USING btree (tenant_id, performed_at DESC);


--
-- Name: booking_internal_messages_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_internal_messages_booking_idx ON public.booking_internal_messages USING btree (booking_id, created_at DESC);


--
-- Name: booking_internal_messages_mentions_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_internal_messages_mentions_idx ON public.booking_internal_messages USING gin (mention_user_ids);


--
-- Name: booking_internal_messages_tenant_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_internal_messages_tenant_recent_idx ON public.booking_internal_messages USING btree (tenant_id, created_at DESC);


--
-- Name: booking_proofs_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_proofs_booking_idx ON public.booking_proofs USING btree (booking_id);


--
-- Name: booking_proofs_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_proofs_tenant_id_idx ON public.booking_proofs USING btree (tenant_id);


--
-- Name: booking_waivers_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_waivers_booking_idx ON public.booking_waivers USING btree (booking_id);


--
-- Name: booking_waivers_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_waivers_tenant_id_idx ON public.booking_waivers USING btree (tenant_id);


--
-- Name: bookings_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_tenant_id_idx ON public.bookings USING btree (tenant_id);


--
-- Name: campaign_recipients_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_recipients_campaign_idx ON public.campaign_recipients USING btree (campaign_id, succeeded);


--
-- Name: campaigns_scheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_scheduled_idx ON public.campaigns USING btree (scheduled_at) WHERE (status = 'scheduled'::text);


--
-- Name: campaigns_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_tenant_idx ON public.campaigns USING btree (tenant_id, created_at DESC);


--
-- Name: categories_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_tenant_id_idx ON public.categories USING btree (tenant_id);


--
-- Name: coi_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coi_requests_status_idx ON public.coi_requests USING btree (status, requested_at DESC) WHERE (status = ANY (ARRAY['requested'::text, 'uploaded'::text]));


--
-- Name: coi_requests_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coi_requests_tenant_id_idx ON public.coi_requests USING btree (tenant_id);


--
-- Name: contact_message_replies_msg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_message_replies_msg_idx ON public.contact_message_replies USING btree (message_id, sent_at);


--
-- Name: contact_messages_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_messages_email_idx ON public.contact_messages USING btree (email);


--
-- Name: contact_messages_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_messages_tenant_id_idx ON public.contact_messages USING btree (tenant_id);


--
-- Name: contact_messages_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_messages_unresolved_idx ON public.contact_messages USING btree (is_resolved, created_at DESC) WHERE (is_resolved = false);


--
-- Name: coupons_referrer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coupons_referrer_idx ON public.coupons USING btree (referrer_user_id) WHERE (referrer_user_id IS NOT NULL);


--
-- Name: coupons_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coupons_tenant_id_idx ON public.coupons USING btree (tenant_id);


--
-- Name: custom_reports_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX custom_reports_tenant_idx ON public.custom_reports USING btree (tenant_id, created_at DESC);


--
-- Name: customer_profiles_ref_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_ref_code_idx ON public.customer_profiles USING btree (referral_code);


--
-- Name: customer_profiles_referred_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_referred_by_idx ON public.customer_profiles USING btree (referred_by_user_id);


--
-- Name: customer_profiles_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_tenant_id_idx ON public.customer_profiles USING btree (tenant_id);


--
-- Name: customer_reviews_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_reviews_active_idx ON public.customer_reviews USING btree (is_active, is_featured DESC, sort_order, reviewed_at DESC);


--
-- Name: customer_reviews_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_reviews_tenant_id_idx ON public.customer_reviews USING btree (tenant_id);


--
-- Name: customer_tags_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_tags_email_idx ON public.customer_tags USING btree (tenant_id, lower(customer_email));


--
-- Name: customer_tags_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_tags_name_idx ON public.customer_tags USING btree (tenant_id, tag_name);


--
-- Name: dispatch_route_units_route_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_route_units_route_idx ON public.dispatch_route_units USING btree (route_id);


--
-- Name: dispatch_route_units_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_route_units_unit_idx ON public.dispatch_route_units USING btree (unit_id, returned_at);


--
-- Name: dispatch_routes_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_routes_date_idx ON public.dispatch_routes USING btree (route_date);


--
-- Name: dispatch_routes_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_routes_tenant_id_idx ON public.dispatch_routes USING btree (tenant_id);


--
-- Name: dispatch_routes_type_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_routes_type_date_idx ON public.dispatch_routes USING btree (route_type, route_date);


--
-- Name: dispatch_stops_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_stops_booking_idx ON public.dispatch_stops USING btree (booking_id);


--
-- Name: dispatch_stops_route_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_stops_route_idx ON public.dispatch_stops USING btree (route_id, stop_order);


--
-- Name: dispatch_stops_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_stops_tenant_id_idx ON public.dispatch_stops USING btree (tenant_id);


--
-- Name: driver_tax_profiles_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_tax_profiles_tenant_id_idx ON public.driver_tax_profiles USING btree (tenant_id);


--
-- Name: driver_tax_profiles_w9_received_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_tax_profiles_w9_received_idx ON public.driver_tax_profiles USING btree (w9_received_at) WHERE (w9_received_at IS NOT NULL);


--
-- Name: email_accounts_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_accounts_active_idx ON public.email_accounts USING btree (is_active) WHERE is_active;


--
-- Name: email_audit_account_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_audit_account_created_idx ON public.email_audit_log USING btree (account_id, created_at DESC);


--
-- Name: email_folders_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_folders_account_idx ON public.email_folders USING btree (account_id, is_active);


--
-- Name: email_messages_account_uid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_messages_account_uid_idx ON public.email_messages USING btree (account_id, imap_uid);


--
-- Name: email_messages_msgid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_messages_msgid_unique ON public.email_messages USING btree (account_id, message_id_header) WHERE (message_id_header IS NOT NULL);


--
-- Name: email_messages_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_messages_thread_idx ON public.email_messages USING btree (thread_id, received_at);


--
-- Name: email_rules_active_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_rules_active_priority_idx ON public.email_rules USING btree (account_id, is_active, priority);


--
-- Name: email_templates_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_templates_key_idx ON public.email_templates USING btree (key);


--
-- Name: email_templates_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_templates_tenant_id_idx ON public.email_templates USING btree (tenant_id);


--
-- Name: email_threads_account_folder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_threads_account_folder_idx ON public.email_threads USING btree (account_id, folder_id, last_message_at DESC);


--
-- Name: email_threads_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_threads_archived_idx ON public.email_threads USING btree (account_id, archived_at);


--
-- Name: faqs_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faqs_tenant_id_idx ON public.faqs USING btree (tenant_id);


--
-- Name: gbp_connections_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gbp_connections_tenant_idx ON public.google_business_connections USING btree (tenant_id);


--
-- Name: gbp_posts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gbp_posts_tenant_idx ON public.google_business_posts USING btree (tenant_id, created_at DESC);


--
-- Name: gbp_reviews_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gbp_reviews_tenant_idx ON public.google_business_reviews USING btree (tenant_id, reviewed_at DESC);


--
-- Name: gbp_reviews_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gbp_reviews_unread_idx ON public.google_business_reviews USING btree (tenant_id, reviewed_at DESC) WHERE (reply_comment IS NULL);


--
-- Name: gift_card_purchases_pi_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_card_purchases_pi_idx ON public.gift_card_purchases USING btree (stripe_payment_intent_id);


--
-- Name: gift_card_purchases_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_card_purchases_recipient_idx ON public.gift_card_purchases USING btree (recipient_email);


--
-- Name: gift_card_purchases_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_card_purchases_status_idx ON public.gift_card_purchases USING btree (status, created_at DESC);


--
-- Name: gift_card_purchases_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_card_purchases_tenant_id_idx ON public.gift_card_purchases USING btree (tenant_id);


--
-- Name: gift_card_redemptions_card_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_card_redemptions_card_idx ON public.gift_card_redemptions USING btree (gift_card_id);


--
-- Name: gift_card_redemptions_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_card_redemptions_tenant_id_idx ON public.gift_card_redemptions USING btree (tenant_id);


--
-- Name: gift_cards_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_cards_code_idx ON public.gift_cards USING btree (code);


--
-- Name: gift_cards_recipient_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_cards_recipient_email_idx ON public.gift_cards USING btree (recipient_email);


--
-- Name: gift_cards_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gift_cards_tenant_id_idx ON public.gift_cards USING btree (tenant_id);


--
-- Name: gpc_stale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gpc_stale_idx ON public.google_places_cache USING btree (last_synced_at);


--
-- Name: home_banners_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_banners_active_idx ON public.home_banners USING btree (is_active);


--
-- Name: home_banners_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_banners_sort_idx ON public.home_banners USING btree (sort_order);


--
-- Name: home_banners_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_banners_tenant_id_idx ON public.home_banners USING btree (tenant_id);


--
-- Name: idx_blocked_dates_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_dates_date ON public.blocked_dates USING btree (blocked_date);


--
-- Name: idx_blocked_dates_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_dates_product ON public.blocked_dates USING btree (product_id);


--
-- Name: idx_bookings_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_email ON public.bookings USING btree (customer_email);


--
-- Name: idx_bookings_event_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_event_date ON public.bookings USING btree (event_date);


--
-- Name: idx_bookings_ghl_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_ghl_contact ON public.bookings USING btree (ghl_contact_id);


--
-- Name: idx_bookings_hold_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_hold_expires ON public.bookings USING btree (hold_expires_at) WHERE (booking_status = 'pending_payment'::text);


--
-- Name: idx_bookings_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_product_date ON public.bookings USING btree (product_id, event_date);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (booking_status);


--
-- Name: idx_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_active ON public.categories USING btree (is_active);


--
-- Name: idx_categories_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_order ON public.categories USING btree (display_order);


--
-- Name: idx_coupons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_active ON public.coupons USING btree (is_active);


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_code ON public.coupons USING btree (code);


--
-- Name: idx_faqs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faqs_active ON public.faqs USING btree (is_active);


--
-- Name: idx_faqs_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faqs_order ON public.faqs USING btree (display_order);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category);


--
-- Name: idx_products_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_slug ON public.products USING btree (slug);


--
-- Name: idx_site_settings_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_settings_category ON public.site_settings USING btree (category);


--
-- Name: inspection_templates_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inspection_templates_category_idx ON public.inspection_templates USING btree (category_id) WHERE (category_id IS NOT NULL);


--
-- Name: inspection_templates_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inspection_templates_product_idx ON public.inspection_templates USING btree (product_id) WHERE (product_id IS NOT NULL);


--
-- Name: inspection_templates_tenant_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inspection_templates_tenant_active_idx ON public.inspection_templates USING btree (tenant_id, is_active);


--
-- Name: inventory_categories_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_categories_active_idx ON public.inventory_categories USING btree (is_active, sort_order);


--
-- Name: inventory_categories_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_categories_tenant_id_idx ON public.inventory_categories USING btree (tenant_id);


--
-- Name: inventory_items_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_category_idx ON public.inventory_items USING btree (category);


--
-- Name: inventory_items_condition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_condition_idx ON public.inventory_items USING btree (condition);


--
-- Name: inventory_items_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_is_active_idx ON public.inventory_items USING btree (is_active);


--
-- Name: inventory_items_low_stock_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_low_stock_idx ON public.inventory_items USING btree (is_active, low_stock_threshold) WHERE ((is_active = true) AND (low_stock_threshold > 0));


--
-- Name: inventory_items_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_tenant_id_idx ON public.inventory_items USING btree (tenant_id);


--
-- Name: inventory_maintenance_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_maintenance_item_idx ON public.inventory_maintenance USING btree (inventory_item_id, performed_at DESC);


--
-- Name: inventory_maintenance_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_maintenance_type_idx ON public.inventory_maintenance USING btree (type);


--
-- Name: inventory_unit_movements_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_movements_booking_idx ON public.inventory_unit_movements USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- Name: inventory_unit_movements_tenant_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_movements_tenant_recent_idx ON public.inventory_unit_movements USING btree (tenant_id, occurred_at DESC);


--
-- Name: inventory_unit_movements_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_movements_unit_idx ON public.inventory_unit_movements USING btree (inventory_unit_id, occurred_at DESC);


--
-- Name: inventory_units_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_units_item_idx ON public.inventory_units USING btree (inventory_item_id, is_active, tag);


--
-- Name: inventory_units_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_units_state_idx ON public.inventory_units USING btree (current_state) WHERE (is_active = true);


--
-- Name: inventory_units_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_units_tenant_id_idx ON public.inventory_units USING btree (tenant_id);


--
-- Name: kb_articles_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kb_articles_published_idx ON public.kb_articles USING btree (is_published, category);


--
-- Name: kb_articles_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kb_articles_slug_idx ON public.kb_articles USING btree (slug);


--
-- Name: lead_magnet_signups_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_magnet_signups_email_idx ON public.lead_magnet_signups USING btree (email);


--
-- Name: lead_magnet_signups_pending_sync_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_magnet_signups_pending_sync_idx ON public.lead_magnet_signups USING btree (created_at) WHERE (ghl_synced_at IS NULL);


--
-- Name: lead_magnet_signups_tool_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_magnet_signups_tool_created_idx ON public.lead_magnet_signups USING btree (tool_name, created_at DESC);


--
-- Name: loyalty_transactions_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_transactions_tenant_id_idx ON public.loyalty_transactions USING btree (tenant_id);


--
-- Name: loyalty_tx_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_tx_booking_idx ON public.loyalty_transactions USING btree (booking_id);


--
-- Name: loyalty_tx_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_tx_user_idx ON public.loyalty_transactions USING btree (user_id, created_at DESC);


--
-- Name: overhead_categories_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX overhead_categories_active_idx ON public.overhead_categories USING btree (is_active, sort_order) WHERE (is_active = true);


--
-- Name: overhead_categories_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX overhead_categories_tenant_id_idx ON public.overhead_categories USING btree (tenant_id);


--
-- Name: overhead_costs_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX overhead_costs_active_idx ON public.overhead_costs USING btree (category, effective_from) WHERE (effective_to IS NULL);


--
-- Name: overhead_costs_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX overhead_costs_tenant_id_idx ON public.overhead_costs USING btree (tenant_id);


--
-- Name: packages_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX packages_active_idx ON public.packages USING btree (is_active, display_order);


--
-- Name: packages_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX packages_tenant_id_idx ON public.packages USING btree (tenant_id);


--
-- Name: payout_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payout_requests_status_idx ON public.payout_requests USING btree (status) WHERE (status = 'pending'::text);


--
-- Name: payout_requests_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payout_requests_tenant_id_idx ON public.payout_requests USING btree (tenant_id);


--
-- Name: payout_requests_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payout_requests_user_idx ON public.payout_requests USING btree (user_id, requested_at DESC);


--
-- Name: portal_otp_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_otp_email_idx ON public.portal_otp_codes USING btree (email, created_at DESC);


--
-- Name: portal_otp_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_otp_expires_idx ON public.portal_otp_codes USING btree (expires_at) WHERE (consumed_at IS NULL);


--
-- Name: product_images_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_product_idx ON public.product_images USING btree (product_id, is_active, sort_order);


--
-- Name: product_images_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_tenant_id_idx ON public.product_images USING btree (tenant_id);


--
-- Name: product_inv_req_inventory_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_inv_req_inventory_idx ON public.product_inventory_requirements USING btree (inventory_item_id);


--
-- Name: product_inv_req_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_inv_req_product_idx ON public.product_inventory_requirements USING btree (product_id);


--
-- Name: product_inventory_requirements_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_inventory_requirements_tenant_id_idx ON public.product_inventory_requirements USING btree (tenant_id);


--
-- Name: products_is_addon_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_is_addon_idx ON public.products USING btree (is_addon);


--
-- Name: products_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_tenant_id_idx ON public.products USING btree (tenant_id);


--
-- Name: quotes_customer_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_customer_email_idx ON public.quotes USING btree (customer_email);


--
-- Name: quotes_event_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_event_date_idx ON public.quotes USING btree (event_date);


--
-- Name: quotes_followup_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_followup_pending_idx ON public.quotes USING btree (sent_at) WHERE ((status = ANY (ARRAY['sent'::text, 'viewed'::text])) AND (followup_sent_at IS NULL));


--
-- Name: quotes_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_status_idx ON public.quotes USING btree (status);


--
-- Name: quotes_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_tenant_id_idx ON public.quotes USING btree (tenant_id);


--
-- Name: quotes_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_token_idx ON public.quotes USING btree (token);


--
-- Name: setup_surfaces_tenant_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setup_surfaces_tenant_active_idx ON public.setup_surfaces USING btree (tenant_id, is_active, display_order);


--
-- Name: site_settings_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_settings_tenant_id_idx ON public.site_settings USING btree (tenant_id);


--
-- Name: superadmin_goals_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX superadmin_goals_active_idx ON public.superadmin_goals USING btree (is_active, target_date);


--
-- Name: support_ticket_replies_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_replies_ticket_idx ON public.support_ticket_replies USING btree (ticket_id, created_at);


--
-- Name: support_tickets_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_category_idx ON public.support_tickets USING btree (category);


--
-- Name: support_tickets_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_status_idx ON public.support_tickets USING btree (status, created_at DESC);


--
-- Name: support_tickets_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_tenant_idx ON public.support_tickets USING btree (tenant_id, created_at DESC);


--
-- Name: tenant_api_keys_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_api_keys_hash_idx ON public.tenant_api_keys USING btree (key_hash) WHERE (revoked_at IS NULL);


--
-- Name: tenant_api_keys_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_api_keys_tenant_idx ON public.tenant_api_keys USING btree (tenant_id, created_at DESC);


--
-- Name: tenant_checklist_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_checklist_tenant_idx ON public.tenant_onboarding_checklist USING btree (tenant_id);


--
-- Name: tenant_goals_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_goals_tenant_idx ON public.tenant_goals USING btree (tenant_id, is_active, target_date);


--
-- Name: tenant_home_sections_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_home_sections_tenant_idx ON public.tenant_home_sections USING btree (tenant_id, is_enabled, display_order);


--
-- Name: tenant_notes_followup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_notes_followup_idx ON public.tenant_operator_notes USING btree (follow_up_date) WHERE ((follow_up_date IS NOT NULL) AND (is_resolved = false));


--
-- Name: tenant_notes_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_notes_tenant_idx ON public.tenant_operator_notes USING btree (tenant_id, created_at DESC);


--
-- Name: tenant_webhooks_events_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_webhooks_events_idx ON public.tenant_webhooks USING gin (events);


--
-- Name: tenant_webhooks_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_webhooks_tenant_idx ON public.tenant_webhooks USING btree (tenant_id, is_active);


--
-- Name: tenants_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_active_idx ON public.tenants USING btree (suspended_at) WHERE (suspended_at IS NULL);


--
-- Name: tenants_calendar_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_calendar_token_idx ON public.tenants USING btree (calendar_feed_token) WHERE (calendar_feed_token IS NOT NULL);


--
-- Name: tenants_custom_domain_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_custom_domain_idx ON public.tenants USING btree (custom_domain) WHERE (custom_domain IS NOT NULL);


--
-- Name: tenants_dunning_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_dunning_active_idx ON public.tenants USING btree (dunning_started_at) WHERE ((dunning_started_at IS NOT NULL) AND (dunning_recovered_at IS NULL));


--
-- Name: tenants_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_slug_idx ON public.tenants USING btree (slug);


--
-- Name: tenants_stripe_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_stripe_customer_idx ON public.tenants USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- Name: tenants_subscription_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_subscription_status_idx ON public.tenants USING btree (subscription_status);


--
-- Name: trailers_compatible_items_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trailers_compatible_items_idx ON public.trailers USING gin (compatible_inventory_item_ids);


--
-- Name: trailers_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trailers_tag_idx ON public.trailers USING btree (license_tag) WHERE (license_tag IS NOT NULL);


--
-- Name: trailers_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trailers_tenant_id_idx ON public.trailers USING btree (tenant_id);


--
-- Name: trailers_vin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trailers_vin_idx ON public.trailers USING btree (vin) WHERE (vin IS NOT NULL);


--
-- Name: user_roles_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_is_active_idx ON public.user_roles USING btree (is_active);


--
-- Name: user_roles_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_role_idx ON public.user_roles USING btree (role);


--
-- Name: user_roles_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_tenant_id_idx ON public.user_roles USING btree (tenant_id);


--
-- Name: vehicles_compatible_items_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicles_compatible_items_idx ON public.vehicles USING gin (compatible_inventory_item_ids);


--
-- Name: vehicles_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicles_tag_idx ON public.vehicles USING btree (license_tag) WHERE (license_tag IS NOT NULL);


--
-- Name: vehicles_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicles_tenant_id_idx ON public.vehicles USING btree (tenant_id);


--
-- Name: vehicles_vin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicles_vin_idx ON public.vehicles USING btree (vin) WHERE (vin IS NOT NULL);


--
-- Name: webhook_deliveries_retry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_deliveries_retry_idx ON public.webhook_deliveries USING btree (next_retry_at) WHERE ((succeeded = false) AND (next_retry_at IS NOT NULL));


--
-- Name: webhook_deliveries_webhook_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_deliveries_webhook_idx ON public.webhook_deliveries USING btree (webhook_id, created_at DESC);


--
-- Name: booking_inspections booking_inspections_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_inspections_touch BEFORE UPDATE ON public.booking_inspections FOR EACH ROW EXECUTE FUNCTION public.touch_inspection_updated_at();


--
-- Name: bookings bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.bump_categories_updated_at();


--
-- Name: coi_requests coi_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER coi_requests_set_updated_at BEFORE UPDATE ON public.coi_requests FOR EACH ROW EXECUTE FUNCTION public.touch_coi_requests_updated_at();


--
-- Name: coupons coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.bump_coupons_updated_at();


--
-- Name: customer_profiles customer_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_profiles_set_updated_at BEFORE UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_customer_profiles_updated_at();


--
-- Name: customer_reviews customer_reviews_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_reviews_set_updated_at BEFORE UPDATE ON public.customer_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_customer_reviews_updated_at();


--
-- Name: dispatch_routes dispatch_routes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dispatch_routes_set_updated_at BEFORE UPDATE ON public.dispatch_routes FOR EACH ROW EXECUTE FUNCTION public.touch_fleet_updated_at();


--
-- Name: email_templates email_templates_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_templates_set_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.touch_email_templates_updated_at();


--
-- Name: faqs faqs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.bump_faqs_updated_at();


--
-- Name: gift_cards gift_cards_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER gift_cards_set_updated_at BEFORE UPDATE ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION public.touch_gift_cards_updated_at();


--
-- Name: home_banners home_banners_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_banners_set_updated_at BEFORE UPDATE ON public.home_banners FOR EACH ROW EXECUTE FUNCTION public.touch_home_banners_updated_at();


--
-- Name: inspection_templates inspection_templates_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inspection_templates_touch BEFORE UPDATE ON public.inspection_templates FOR EACH ROW EXECUTE FUNCTION public.touch_inspection_updated_at();


--
-- Name: inventory_categories inventory_categories_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_categories_set_updated_at BEFORE UPDATE ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.touch_inventory_categories_updated_at();


--
-- Name: inventory_items inventory_items_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_items_set_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.touch_inventory_updated_at();


--
-- Name: inventory_unit_movements inventory_unit_movements_touch_cache; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_unit_movements_touch_cache AFTER INSERT ON public.inventory_unit_movements FOR EACH ROW EXECUTE FUNCTION public.touch_unit_state_after_movement();


--
-- Name: inventory_units inventory_units_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_units_set_updated_at BEFORE UPDATE ON public.inventory_units FOR EACH ROW EXECUTE FUNCTION public.touch_inventory_units_updated_at();


--
-- Name: overhead_costs overhead_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER overhead_set_updated_at BEFORE UPDATE ON public.overhead_costs FOR EACH ROW EXECUTE FUNCTION public.touch_overhead_updated_at();


--
-- Name: packages packages_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER packages_set_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.touch_packages_updated_at();


--
-- Name: product_inventory_requirements product_inv_req_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_inv_req_set_updated_at BEFORE UPDATE ON public.product_inventory_requirements FOR EACH ROW EXECUTE FUNCTION public.touch_product_inv_req_updated_at();


--
-- Name: quotes quotes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quotes_set_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.touch_quotes_updated_at();


--
-- Name: site_settings site_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.bump_site_settings_updated_at();


--
-- Name: trailers trailers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trailers_set_updated_at BEFORE UPDATE ON public.trailers FOR EACH ROW EXECUTE FUNCTION public.touch_fleet_updated_at();


--
-- Name: driver_tax_profiles trg_touch_driver_tax_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_driver_tax_profiles BEFORE UPDATE ON public.driver_tax_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_driver_tax_profiles_updated_at();


--
-- Name: overhead_categories trg_touch_overhead_categories; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_overhead_categories BEFORE UPDATE ON public.overhead_categories FOR EACH ROW EXECUTE FUNCTION public.touch_overhead_categories_updated_at();


--
-- Name: tenants trg_touch_tenants; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_tenants BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.touch_tenants_updated_at();


--
-- Name: user_roles user_roles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_roles_set_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.touch_user_roles_updated_at();


--
-- Name: vehicles vehicles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vehicles_set_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.touch_fleet_updated_at();


--
-- Name: admin_audit_log admin_audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: blocked_dates blocked_dates_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_dates
    ADD CONSTRAINT blocked_dates_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: booking_damages booking_damages_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_damages
    ADD CONSTRAINT booking_damages_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: booking_damages booking_damages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_damages
    ADD CONSTRAINT booking_damages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: booking_expenses booking_expenses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_expenses
    ADD CONSTRAINT booking_expenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: booking_extensions booking_extensions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_extensions
    ADD CONSTRAINT booking_extensions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: booking_inspections booking_inspections_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_inspections
    ADD CONSTRAINT booking_inspections_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_inspections booking_inspections_inspector_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_inspections
    ADD CONSTRAINT booking_inspections_inspector_user_id_fkey FOREIGN KEY (inspector_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: booking_inspections booking_inspections_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_inspections
    ADD CONSTRAINT booking_inspections_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.inspection_templates(id) ON DELETE SET NULL;


--
-- Name: booking_inspections booking_inspections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_inspections
    ADD CONSTRAINT booking_inspections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: booking_internal_messages booking_internal_messages_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_internal_messages
    ADD CONSTRAINT booking_internal_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: booking_internal_messages booking_internal_messages_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_internal_messages
    ADD CONSTRAINT booking_internal_messages_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_internal_messages booking_internal_messages_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_internal_messages
    ADD CONSTRAINT booking_internal_messages_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: booking_internal_messages booking_internal_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_internal_messages
    ADD CONSTRAINT booking_internal_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: booking_proofs booking_proofs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_proofs
    ADD CONSTRAINT booking_proofs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: booking_waivers booking_waivers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waivers
    ADD CONSTRAINT booking_waivers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: bookings bookings_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: bookings bookings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: campaign_recipients campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: categories categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: coi_requests coi_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coi_requests
    ADD CONSTRAINT coi_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: contact_message_replies contact_message_replies_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_message_replies
    ADD CONSTRAINT contact_message_replies_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.contact_messages(id) ON DELETE CASCADE;


--
-- Name: contact_messages contact_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: coupons coupons_referrer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_referrer_user_id_fkey FOREIGN KEY (referrer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: coupons coupons_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: custom_reports custom_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: customer_profiles customer_profiles_referred_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_referred_by_user_id_fkey FOREIGN KEY (referred_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customer_profiles customer_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: customer_profiles customer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customer_reviews customer_reviews_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews
    ADD CONSTRAINT customer_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: customer_tags customer_tags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT customer_tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: dispatch_route_units dispatch_route_units_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_route_units
    ADD CONSTRAINT dispatch_route_units_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.dispatch_routes(id) ON DELETE CASCADE;


--
-- Name: dispatch_route_units dispatch_route_units_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_route_units
    ADD CONSTRAINT dispatch_route_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.inventory_units(id) ON DELETE CASCADE;


--
-- Name: dispatch_routes dispatch_routes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_routes
    ADD CONSTRAINT dispatch_routes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: dispatch_routes dispatch_routes_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_routes
    ADD CONSTRAINT dispatch_routes_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id) ON DELETE SET NULL;


--
-- Name: dispatch_routes dispatch_routes_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_routes
    ADD CONSTRAINT dispatch_routes_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: dispatch_stops dispatch_stops_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_stops
    ADD CONSTRAINT dispatch_stops_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.dispatch_routes(id) ON DELETE CASCADE;


--
-- Name: dispatch_stops dispatch_stops_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_stops
    ADD CONSTRAINT dispatch_stops_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: driver_tax_profiles driver_tax_profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_tax_profiles
    ADD CONSTRAINT driver_tax_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: email_audit_log email_audit_log_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_audit_log
    ADD CONSTRAINT email_audit_log_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.email_accounts(id) ON DELETE SET NULL;


--
-- Name: email_folders email_folders_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_folders
    ADD CONSTRAINT email_folders_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.email_accounts(id) ON DELETE CASCADE;


--
-- Name: email_labels email_labels_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_labels
    ADD CONSTRAINT email_labels_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.email_accounts(id) ON DELETE CASCADE;


--
-- Name: email_messages email_messages_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.email_accounts(id) ON DELETE CASCADE;


--
-- Name: email_messages email_messages_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.email_folders(id) ON DELETE SET NULL;


--
-- Name: email_messages email_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.email_threads(id) ON DELETE CASCADE;


--
-- Name: email_rules email_rules_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_rules
    ADD CONSTRAINT email_rules_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.email_accounts(id) ON DELETE CASCADE;


--
-- Name: email_templates email_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: email_thread_labels email_thread_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_thread_labels
    ADD CONSTRAINT email_thread_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.email_labels(id) ON DELETE CASCADE;


--
-- Name: email_thread_labels email_thread_labels_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_thread_labels
    ADD CONSTRAINT email_thread_labels_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.email_threads(id) ON DELETE CASCADE;


--
-- Name: email_threads email_threads_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.email_accounts(id) ON DELETE CASCADE;


--
-- Name: email_threads email_threads_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.email_folders(id) ON DELETE SET NULL;


--
-- Name: faqs faqs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: gift_card_purchases gift_card_purchases_gift_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_purchases
    ADD CONSTRAINT gift_card_purchases_gift_card_id_fkey FOREIGN KEY (gift_card_id) REFERENCES public.gift_cards(id) ON DELETE SET NULL;


--
-- Name: gift_card_purchases gift_card_purchases_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_purchases
    ADD CONSTRAINT gift_card_purchases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: gift_card_redemptions gift_card_redemptions_gift_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_redemptions
    ADD CONSTRAINT gift_card_redemptions_gift_card_id_fkey FOREIGN KEY (gift_card_id) REFERENCES public.gift_cards(id) ON DELETE CASCADE;


--
-- Name: gift_card_redemptions gift_card_redemptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_redemptions
    ADD CONSTRAINT gift_card_redemptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: gift_cards gift_cards_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: google_business_connections google_business_connections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_business_connections
    ADD CONSTRAINT google_business_connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: google_business_posts google_business_posts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_business_posts
    ADD CONSTRAINT google_business_posts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: google_business_reviews google_business_reviews_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_business_reviews
    ADD CONSTRAINT google_business_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: google_places_cache google_places_cache_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_places_cache
    ADD CONSTRAINT google_places_cache_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: home_banners home_banners_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_banners
    ADD CONSTRAINT home_banners_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: inspection_templates inspection_templates_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_templates
    ADD CONSTRAINT inspection_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: inspection_templates inspection_templates_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_templates
    ADD CONSTRAINT inspection_templates_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: inspection_templates inspection_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_templates
    ADD CONSTRAINT inspection_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: inventory_categories inventory_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: inventory_items inventory_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: inventory_maintenance inventory_maintenance_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_maintenance
    ADD CONSTRAINT inventory_maintenance_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_unit_movements inventory_unit_movements_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_movements
    ADD CONSTRAINT inventory_unit_movements_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: inventory_unit_movements inventory_unit_movements_inventory_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_movements
    ADD CONSTRAINT inventory_unit_movements_inventory_unit_id_fkey FOREIGN KEY (inventory_unit_id) REFERENCES public.inventory_units(id) ON DELETE CASCADE;


--
-- Name: inventory_unit_movements inventory_unit_movements_performed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_movements
    ADD CONSTRAINT inventory_unit_movements_performed_by_user_id_fkey FOREIGN KEY (performed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inventory_unit_movements inventory_unit_movements_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_movements
    ADD CONSTRAINT inventory_unit_movements_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.dispatch_routes(id) ON DELETE SET NULL;


--
-- Name: inventory_unit_movements inventory_unit_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_movements
    ADD CONSTRAINT inventory_unit_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: inventory_units inventory_units_current_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_units
    ADD CONSTRAINT inventory_units_current_booking_id_fkey FOREIGN KEY (current_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: inventory_units inventory_units_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_units
    ADD CONSTRAINT inventory_units_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_units inventory_units_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_units
    ADD CONSTRAINT inventory_units_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: loyalty_transactions loyalty_transactions_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_transactions loyalty_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: loyalty_transactions loyalty_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: overhead_categories overhead_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overhead_categories
    ADD CONSTRAINT overhead_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: overhead_costs overhead_costs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overhead_costs
    ADD CONSTRAINT overhead_costs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: packages packages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: payout_requests payout_requests_linked_gift_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT payout_requests_linked_gift_card_id_fkey FOREIGN KEY (linked_gift_card_id) REFERENCES public.gift_cards(id) ON DELETE SET NULL;


--
-- Name: payout_requests payout_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT payout_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: payout_requests payout_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT payout_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: portal_otp_codes portal_otp_codes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_otp_codes
    ADD CONSTRAINT portal_otp_codes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: product_inventory_requirements product_inventory_requirements_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inventory_requirements
    ADD CONSTRAINT product_inventory_requirements_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: product_inventory_requirements product_inventory_requirements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_inventory_requirements
    ADD CONSTRAINT product_inventory_requirements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: quotes quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: quotes quotes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: site_settings site_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: support_ticket_replies support_ticket_replies_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_replies
    ADD CONSTRAINT support_ticket_replies_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: tenant_api_keys tenant_api_keys_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_goals tenant_goals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_goals
    ADD CONSTRAINT tenant_goals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_home_sections tenant_home_sections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_home_sections
    ADD CONSTRAINT tenant_home_sections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_onboarding_checklist tenant_onboarding_checklist_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_onboarding_checklist
    ADD CONSTRAINT tenant_onboarding_checklist_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_operator_notes tenant_operator_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_operator_notes
    ADD CONSTRAINT tenant_operator_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_profile tenant_profile_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_profile
    ADD CONSTRAINT tenant_profile_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_webhooks tenant_webhooks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_webhooks
    ADD CONSTRAINT tenant_webhooks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: trailers trailers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trailers
    ADD CONSTRAINT trailers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: webhook_deliveries webhook_deliveries_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.tenant_webhooks(id) ON DELETE CASCADE;


--
-- Name: inventory_items admin can write inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can write inventory" ON public.inventory_items USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: home_banners admin manage banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage banners" ON public.home_banners USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: contact_messages admin manage contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage contact messages" ON public.contact_messages USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: driver_tax_profiles admin manage driver_tax_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage driver_tax_profiles" ON public.driver_tax_profiles USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: booking_expenses admin manage expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage expenses" ON public.booking_expenses USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: gift_cards admin manage gift cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage gift cards" ON public.gift_cards USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: inventory_categories admin manage inventory categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage inventory categories" ON public.inventory_categories USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: inventory_units admin manage inventory units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage inventory units" ON public.inventory_units USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: overhead_costs admin manage overhead; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage overhead" ON public.overhead_costs USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: overhead_categories admin manage overhead_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage overhead_categories" ON public.overhead_categories USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: packages admin manage packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage packages" ON public.packages USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: payout_requests admin manage payout requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage payout requests" ON public.payout_requests USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: customer_profiles admin manage profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage profiles" ON public.customer_profiles USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: quotes admin manage quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage quotes" ON public.quotes USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: contact_message_replies admin manage replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage replies" ON public.contact_message_replies USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: product_inventory_requirements admin manage req; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage req" ON public.product_inventory_requirements USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: setup_surfaces admin manage surfaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage surfaces" ON public.setup_surfaces USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: email_templates admin manage templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage templates" ON public.email_templates USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: trailers admin manage trailers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage trailers" ON public.trailers USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: loyalty_transactions admin manage tx; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage tx" ON public.loyalty_transactions USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: vehicles admin manage vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage vehicles" ON public.vehicles USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: product_images admin manages product images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manages product images" ON public.product_images USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: customer_reviews admin manages reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manages reviews" ON public.customer_reviews USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: admin_audit_log admin read all audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read all audit log" ON public.admin_audit_log FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: driver_tax_profiles admin read driver_tax_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read driver_tax_profiles" ON public.driver_tax_profiles FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: gift_card_purchases admin read gift card purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read gift card purchases" ON public.gift_card_purchases FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: overhead_costs admin read overhead; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read overhead" ON public.overhead_costs FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: overhead_categories admin read overhead_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read overhead_categories" ON public.overhead_categories FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: gift_card_redemptions admin read redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read redemptions" ON public.gift_card_redemptions FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: inventory_items admin write inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin write inventory" ON public.inventory_items USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can manage roles" ON public.user_roles USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: booking_internal_messages author edit own message; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "author edit own message" ON public.booking_internal_messages FOR UPDATE USING ((auth.uid() = author_user_id)) WITH CHECK ((auth.uid() = author_user_id));


--
-- Name: blocked_dates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_damages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_damages ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_emails_sent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_emails_sent ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_extensions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_extensions ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_internal_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_internal_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_proofs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_proofs ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_waivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_waivers ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: coi_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coi_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_message_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_message_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_route_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_route_units ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_routes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_stops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_stops ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_inspections driver_or_above manage booking_inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above manage booking_inspections" ON public.booking_inspections USING ((public.is_staff_or_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'driver'::text) AND ur.is_active))))) WITH CHECK ((public.is_staff_or_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'driver'::text) AND ur.is_active)))));


--
-- Name: booking_damages driver_or_above manage damages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above manage damages" ON public.booking_damages USING (public.is_driver_or_above(auth.uid())) WITH CHECK (public.is_driver_or_above(auth.uid()));


--
-- Name: booking_proofs driver_or_above manage proofs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above manage proofs" ON public.booking_proofs USING (public.is_driver_or_above(auth.uid())) WITH CHECK (public.is_driver_or_above(auth.uid()));


--
-- Name: bookings driver_or_above read bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above read bookings" ON public.bookings FOR SELECT USING (public.is_driver_or_above(auth.uid()));


--
-- Name: inventory_items driver_or_above read inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above read inventory" ON public.inventory_items FOR SELECT USING (public.is_driver_or_above(auth.uid()));


--
-- Name: product_inventory_requirements driver_or_above read req; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above read req" ON public.product_inventory_requirements FOR SELECT USING (public.is_driver_or_above(auth.uid()));


--
-- Name: dispatch_route_units driver_or_above read route units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above read route units" ON public.dispatch_route_units FOR SELECT USING (public.is_driver_or_above(auth.uid()));


--
-- Name: dispatch_routes driver_or_above read routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above read routes" ON public.dispatch_routes FOR SELECT USING (public.is_driver_or_above(auth.uid()));


--
-- Name: dispatch_stops driver_or_above read stops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above read stops" ON public.dispatch_stops FOR SELECT USING (public.is_driver_or_above(auth.uid()));


--
-- Name: dispatch_route_units driver_or_above update route units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above update route units" ON public.dispatch_route_units FOR UPDATE USING (public.is_driver_or_above(auth.uid())) WITH CHECK (public.is_driver_or_above(auth.uid()));


--
-- Name: dispatch_stops driver_or_above update stops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "driver_or_above update stops" ON public.dispatch_stops FOR UPDATE USING (public.is_driver_or_above(auth.uid())) WITH CHECK (public.is_driver_or_above(auth.uid()));


--
-- Name: driver_tax_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_tax_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: email_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: email_labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;

--
-- Name: email_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: email_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: email_thread_labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_thread_labels ENABLE ROW LEVEL SECURITY;

--
-- Name: email_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: faqs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_card_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gift_card_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_card_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: google_business_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_business_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: google_business_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_business_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: google_business_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_business_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: google_places_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_places_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: home_banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

--
-- Name: inspection_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_maintenance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_maintenance ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_unit_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_unit_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;

--
-- Name: kb_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_magnet_signups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_magnet_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: overhead_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.overhead_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: overhead_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.overhead_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

--
-- Name: payout_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_otp_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_otp_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: product_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

--
-- Name: product_inventory_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_inventory_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: home_banners public can read active banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public can read active banners" ON public.home_banners FOR SELECT USING ((is_active = true));


--
-- Name: tenants public can resolve tenant by hostname; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public can resolve tenant by hostname" ON public.tenants FOR SELECT USING (true);


--
-- Name: packages public read active packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read active packages" ON public.packages FOR SELECT USING ((is_active = true));


--
-- Name: home_banners public read banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read banners" ON public.home_banners FOR SELECT USING ((is_active = true));


--
-- Name: product_images public reads active product images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public reads active product images" ON public.product_images FOR SELECT USING ((is_active = true));


--
-- Name: customer_reviews public reads active reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public reads active reviews" ON public.customer_reviews FOR SELECT USING ((is_active = true));


--
-- Name: categories public_read_active_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_active_categories ON public.categories FOR SELECT USING ((is_active = true));


--
-- Name: faqs public_read_active_faqs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_active_faqs ON public.faqs FOR SELECT USING ((is_active = true));


--
-- Name: products public_read_active_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_active_products ON public.products FOR SELECT USING ((is_active = true));


--
-- Name: blocked_dates public_read_blocked_dates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_blocked_dates ON public.blocked_dates FOR SELECT USING (true);


--
-- Name: tenant_home_sections public_read_enabled; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_enabled ON public.tenant_home_sections FOR SELECT USING ((is_enabled = true));


--
-- Name: kb_articles public_read_kb; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_kb ON public.kb_articles FOR SELECT USING ((is_published = true));


--
-- Name: site_settings public_read_site_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_site_settings ON public.site_settings FOR SELECT USING (true);


--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: google_business_connections service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.google_business_connections USING ((auth.role() = 'service_role'::text));


--
-- Name: google_business_posts service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.google_business_posts USING ((auth.role() = 'service_role'::text));


--
-- Name: google_business_reviews service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.google_business_reviews USING ((auth.role() = 'service_role'::text));


--
-- Name: google_places_cache service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.google_places_cache USING ((auth.role() = 'service_role'::text));


--
-- Name: blocked_dates service_role_all_blocked_dates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_blocked_dates ON public.blocked_dates TO service_role USING (true) WITH CHECK (true);


--
-- Name: bookings service_role_all_bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_bookings ON public.bookings TO service_role USING (true) WITH CHECK (true);


--
-- Name: categories service_role_all_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_categories ON public.categories TO service_role USING (true) WITH CHECK (true);


--
-- Name: coupons service_role_all_coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_coupons ON public.coupons TO service_role USING (true) WITH CHECK (true);


--
-- Name: faqs service_role_all_faqs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_faqs ON public.faqs TO service_role USING (true) WITH CHECK (true);


--
-- Name: products service_role_all_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_products ON public.products TO service_role USING (true) WITH CHECK (true);


--
-- Name: site_settings service_role_all_site_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_site_settings ON public.site_settings TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaign_recipients service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.campaign_recipients USING ((auth.role() = 'service_role'::text));


--
-- Name: campaigns service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.campaigns USING ((auth.role() = 'service_role'::text));


--
-- Name: custom_reports service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.custom_reports USING ((auth.role() = 'service_role'::text));


--
-- Name: customer_tags service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.customer_tags USING ((auth.role() = 'service_role'::text));


--
-- Name: daily_insights service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.daily_insights USING ((auth.role() = 'service_role'::text));


--
-- Name: email_accounts service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.email_accounts USING ((auth.role() = 'service_role'::text));


--
-- Name: email_audit_log service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.email_audit_log USING ((auth.role() = 'service_role'::text));


--
-- Name: email_folders service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.email_folders USING ((auth.role() = 'service_role'::text));


--
-- Name: email_labels service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.email_labels USING ((auth.role() = 'service_role'::text));


--
-- Name: email_messages service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.email_messages USING ((auth.role() = 'service_role'::text));


--
-- Name: email_rules service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.email_rules USING ((auth.role() = 'service_role'::text));


--
-- Name: email_thread_labels service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.email_thread_labels USING ((auth.role() = 'service_role'::text));


--
-- Name: email_threads service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.email_threads USING ((auth.role() = 'service_role'::text));


--
-- Name: kb_articles service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.kb_articles USING ((auth.role() = 'service_role'::text));


--
-- Name: lead_magnet_signups service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.lead_magnet_signups USING ((auth.role() = 'service_role'::text));


--
-- Name: portal_otp_codes service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.portal_otp_codes USING ((auth.role() = 'service_role'::text));


--
-- Name: superadmin_goals service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.superadmin_goals USING ((auth.role() = 'service_role'::text));


--
-- Name: support_ticket_replies service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.support_ticket_replies USING ((auth.role() = 'service_role'::text));


--
-- Name: support_tickets service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.support_tickets USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_api_keys service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.tenant_api_keys USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_goals service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.tenant_goals USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_home_sections service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.tenant_home_sections USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_onboarding_checklist service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.tenant_onboarding_checklist USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_operator_notes service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.tenant_operator_notes USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_profile service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.tenant_profile USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_webhooks service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.tenant_webhooks USING ((auth.role() = 'service_role'::text));


--
-- Name: webhook_deliveries service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.webhook_deliveries USING ((auth.role() = 'service_role'::text));


--
-- Name: setup_surfaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.setup_surfaces ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items staff can update operational fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff can update operational fields" ON public.inventory_items FOR UPDATE USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: product_inventory_requirements staff or admin read req; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff or admin read req" ON public.product_inventory_requirements FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: admin_audit_log staff read own audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read own audit log" ON public.admin_audit_log FOR SELECT USING ((public.is_staff_or_admin(auth.uid()) AND (lower(user_email) = lower(COALESCE(auth.email(), ''::text)))));


--
-- Name: quotes staff read quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff read quotes" ON public.quotes FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: inventory_items staff write inventory ops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff write inventory ops" ON public.inventory_items FOR UPDATE USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: inventory_items staff_or_admin can read inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin can read inventory" ON public.inventory_items FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: coi_requests staff_or_admin manage coi; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage coi" ON public.coi_requests USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: booking_damages staff_or_admin manage damages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage damages" ON public.booking_damages USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: booking_extensions staff_or_admin manage extensions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage extensions" ON public.booking_extensions USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: inspection_templates staff_or_admin manage inspection_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage inspection_templates" ON public.inspection_templates USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: inventory_unit_movements staff_or_admin manage inventory_unit_movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage inventory_unit_movements" ON public.inventory_unit_movements USING ((public.is_staff_or_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'driver'::text) AND ur.is_active))))) WITH CHECK ((public.is_staff_or_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'driver'::text) AND ur.is_active)))));


--
-- Name: inventory_maintenance staff_or_admin manage maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage maintenance" ON public.inventory_maintenance USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: booking_proofs staff_or_admin manage proofs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage proofs" ON public.booking_proofs USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: dispatch_route_units staff_or_admin manage route units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage route units" ON public.dispatch_route_units USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: dispatch_routes staff_or_admin manage routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage routes" ON public.dispatch_routes USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: dispatch_stops staff_or_admin manage stops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage stops" ON public.dispatch_stops USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: booking_waivers staff_or_admin manage waivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin manage waivers" ON public.booking_waivers USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()));


--
-- Name: contact_messages staff_or_admin read contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read contact messages" ON public.contact_messages FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: booking_damages staff_or_admin read damages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read damages" ON public.booking_damages FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: booking_expenses staff_or_admin read expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read expenses" ON public.booking_expenses FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: inventory_items staff_or_admin read inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read inventory" ON public.inventory_items FOR SELECT USING (public.is_driver_or_above(auth.uid()));


--
-- Name: inventory_categories staff_or_admin read inventory categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read inventory categories" ON public.inventory_categories FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: inventory_units staff_or_admin read inventory units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read inventory units" ON public.inventory_units FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: inventory_maintenance staff_or_admin read maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read maintenance" ON public.inventory_maintenance FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: booking_proofs staff_or_admin read proofs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read proofs" ON public.booking_proofs FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: contact_message_replies staff_or_admin read replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read replies" ON public.contact_message_replies FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: dispatch_routes staff_or_admin read routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read routes" ON public.dispatch_routes FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: dispatch_stops staff_or_admin read stops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read stops" ON public.dispatch_stops FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: trailers staff_or_admin read trailers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read trailers" ON public.trailers FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: vehicles staff_or_admin read vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_or_admin read vehicles" ON public.vehicles FOR SELECT USING (public.is_staff_or_admin(auth.uid()));


--
-- Name: tenants superadmin manages tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "superadmin manages tenants" ON public.tenants USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));


--
-- Name: superadmin_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.superadmin_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_internal_messages team post internal messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team post internal messages" ON public.booking_internal_messages FOR INSERT WITH CHECK ((public.is_staff_or_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'driver'::text) AND ur.is_active)))));


--
-- Name: booking_internal_messages team read internal messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team read internal messages" ON public.booking_internal_messages FOR SELECT USING ((public.is_staff_or_admin(auth.uid()) OR ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'driver'::text) AND ur.is_active))) AND (EXISTS ( SELECT 1
   FROM public.dispatch_stops ds
  WHERE (ds.booking_id = booking_internal_messages.booking_id))))));


--
-- Name: tenants tenant owner updates own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant owner updates own" ON public.tenants FOR UPDATE USING ((public.is_superadmin(auth.uid()) OR (owner_email = auth.email()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (owner_email = auth.email())));


--
-- Name: setup_surfaces tenant read surfaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant read surfaces" ON public.setup_surfaces FOR SELECT USING (true);


--
-- Name: tenant_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_home_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_home_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.admin_audit_log AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: booking_damages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.booking_damages AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: booking_expenses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.booking_expenses USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: booking_extensions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.booking_extensions AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: booking_proofs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.booking_proofs AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: booking_waivers tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.booking_waivers AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: bookings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bookings USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: categories tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.categories USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: coi_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.coi_requests USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: contact_message_replies tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.contact_message_replies AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: contact_messages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.contact_messages USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: coupons tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.coupons USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: customer_profiles tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.customer_profiles USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: customer_reviews tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.customer_reviews AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: dispatch_routes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.dispatch_routes USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: dispatch_stops tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.dispatch_stops USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: driver_tax_profiles tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.driver_tax_profiles USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: email_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.email_templates USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: faqs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.faqs USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: gift_card_purchases tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.gift_card_purchases AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: gift_card_redemptions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.gift_card_redemptions AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: gift_cards tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.gift_cards USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: home_banners tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.home_banners USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: inventory_categories tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.inventory_categories USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: inventory_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.inventory_items USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: inventory_units tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.inventory_units USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: loyalty_transactions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.loyalty_transactions AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: overhead_categories tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.overhead_categories USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: overhead_costs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.overhead_costs USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: packages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.packages USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: payout_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payout_requests USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: product_images tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.product_images USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: product_inventory_requirements tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.product_inventory_requirements USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: products tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.products USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: quotes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.quotes USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: setup_surfaces tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.setup_surfaces AS RESTRICTIVE TO authenticated, anon USING (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text))) WITH CHECK (((tenant_id)::text = COALESCE(((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text), ''::text)));


--
-- Name: site_settings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.site_settings USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: trailers tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.trailers USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: user_roles tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.user_roles USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: vehicles tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.vehicles USING ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id()))) WITH CHECK ((public.is_superadmin(auth.uid()) OR (tenant_id = public.current_tenant_id())));


--
-- Name: campaigns tenant_members_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_full ON public.campaigns USING ((tenant_id IN ( SELECT user_roles.tenant_id
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.is_active = true)))));


--
-- Name: customer_tags tenant_members_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_full ON public.customer_tags USING ((tenant_id IN ( SELECT user_roles.tenant_id
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.is_active = true)))));


--
-- Name: tenant_home_sections tenant_members_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_full ON public.tenant_home_sections USING ((tenant_id IN ( SELECT user_roles.tenant_id
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.is_active = true)))));


--
-- Name: custom_reports tenant_members_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_full_access ON public.custom_reports USING ((tenant_id IN ( SELECT user_roles.tenant_id
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.is_active = true)))));


--
-- Name: tenant_api_keys tenant_members_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_read ON public.tenant_api_keys FOR SELECT USING ((tenant_id IN ( SELECT user_roles.tenant_id
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.is_active = true)))));


--
-- Name: tenant_goals tenant_members_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_read ON public.tenant_goals FOR SELECT USING ((tenant_id IN ( SELECT user_roles.tenant_id
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.is_active = true)))));


--
-- Name: tenant_webhooks tenant_members_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_read ON public.tenant_webhooks FOR SELECT USING ((tenant_id IN ( SELECT user_roles.tenant_id
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.is_active = true)))));


--
-- Name: tenant_onboarding_checklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_onboarding_checklist ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_operator_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_operator_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: trailers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles users can read own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can read own role" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_audit_log users insert own audit events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own audit events" ON public.admin_audit_log FOR INSERT WITH CHECK ((lower(user_email) = lower(COALESCE(auth.email(), ''::text))));


--
-- Name: payout_requests users insert own payout requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own payout requests" ON public.payout_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: payout_requests users read own payout requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own payout requests" ON public.payout_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: customer_profiles users read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own profile" ON public.customer_profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: loyalty_transactions users read own tx; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own tx" ON public.loyalty_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict tMhb4e3e8q27m1813qcwKmBQOFb5KOwS1hMNpi5UNQJwyOpMlGJA1CoSUUUMMfU

