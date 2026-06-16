-- RPC para que scripts/check-tenant-scope.ts pueda leer information_schema
-- sin tener que conectar via psql. La función es security-definer porque
-- information_schema requiere permisos que el rol authenticated no tiene
-- por default. REVOKE all → solo service_role la puede invocar.

create or replace function public.list_tenant_id_tables()
returns table(table_name text, rls_enabled bool)
language sql security definer as $$
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

revoke all on function public.list_tenant_id_tables() from public;
grant execute on function public.list_tenant_id_tables() to service_role;
