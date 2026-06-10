-- Fix: generate_inventory_units inserted into inventory_units without
-- setting tenant_id, relying on the column DEFAULT. Once we drop that
-- default (OBS-2), the RPC would start failing with a NOT NULL violation.
--
-- Patch: derive tenant_id from the parent inventory_items row and pass
-- it explicitly. No JS caller change needed.

create or replace function public.generate_inventory_units(
  p_item_id uuid,
  p_count integer,
  p_prefix text
) returns integer
language plpgsql
as $$
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
