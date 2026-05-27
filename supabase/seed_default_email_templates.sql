-- ─────────────────────────────────────────────────────────────────────────
-- SEED DEFAULT EMAIL TEMPLATES PER TENANT
-- ─────────────────────────────────────────────────────────────────────────
-- New tenants need a copy of the email templates so emails actually send
-- with their branding (and so they can edit them in /admin/email-templates).
-- Without this, the proxy wrap means `from('email_templates').select()` on a
-- new tenant returns nothing and emails silently fall back to hardcoded
-- defaults in lib/email/templates.ts.
--
-- Strategy:
--   1. Generalize the existing IAF templates so they use {{businessName}}
--      instead of literal "It's Always Fun" — that way once we copy them
--      to new tenants, each email reads as that tenant's brand.
--   2. Create a SECURITY DEFINER function that copies the IAF templates
--      (the master set) into another tenant_id. Idempotent via
--      on conflict (tenant_id, key) do nothing.
--   3. Signup will call this function for every brand-new tenant.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- Step 1: Replace literal IAF strings with {{businessName}} in the master
-- template set (and any tenant that's already been customized). Apply only
-- to templates that contain the literal — leave already-edited ones alone.

update public.email_templates
set subject = replace(subject, 'It''s Always Fun', '{{businessName}}'),
    email_title = replace(email_title, 'It''s Always Fun', '{{businessName}}'),
    body_html = replace(body_html, 'It''s Always Fun', '{{businessName}}'),
    body_text = replace(body_text, 'It''s Always Fun', '{{businessName}}'),
    available_vars = (
      case
        when 'businessName' = any(available_vars) then available_vars
        else array_append(available_vars, 'businessName')
      end
    )
where subject like '%It''s Always Fun%'
   or email_title like '%It''s Always Fun%'
   or body_html like '%It''s Always Fun%'
   or body_text like '%It''s Always Fun%';

-- Step 2: Function — copy master IAF templates into a target tenant
create or replace function public.seed_default_email_templates(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.seed_default_email_templates(uuid) to service_role;

-- Step 3: Backfill — seed every existing tenant that doesn't already
-- have a full set of templates. (One-time catch-up.)
do $$
declare
  t record;
  n int;
begin
  for t in select id, business_name from public.tenants
           where id <> '11111111-1111-1111-1111-111111111111'::uuid
  loop
    n := public.seed_default_email_templates(t.id);
    raise notice 'seeded % template(s) for tenant % (%)', n, t.business_name, t.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
