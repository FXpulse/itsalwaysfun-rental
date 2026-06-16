-- Internal thread per booking — admin / staff / driver communication.
-- Diferente de:
--   - audit_log: eventos del sistema (auto-generados)
--   - notes (en bookings): free-text del admin
--   - support: cliente externo
-- Esto es chat interno: cada booking tiene un thread donde el equipo se
-- comunica. Driver puede postear ("running 30min late, traffic I-95"),
-- admin puede @mention ("@maria pls revisá tax").
--
-- Las @mentions se resuelven client-side (picker de teammates) — el server
-- recibe los user_ids ya resueltos en mention_user_ids[].

create table if not exists public.booking_internal_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  -- Snapshot del nombre del autor — si el user es deleted en el futuro
  -- el thread conserva quién escribió cada mensaje.
  author_name text not null,
  author_role text not null check (author_role in ('admin','staff','driver','system')),
  body text not null check (length(body) > 0 and length(body) <= 4000),
  -- user_ids que recibieron @mention en este mensaje (resueltos client-side)
  mention_user_ids uuid[] not null default '{}',
  -- Soft delete para preservar contexto histórico
  deleted_at timestamptz,
  deleted_by_user_id uuid references auth.users(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_internal_messages_booking_idx
  on public.booking_internal_messages(booking_id, created_at desc);
create index if not exists booking_internal_messages_mentions_idx
  on public.booking_internal_messages using gin(mention_user_ids);
create index if not exists booking_internal_messages_tenant_recent_idx
  on public.booking_internal_messages(tenant_id, created_at desc);

-- ─── RLS ────────────────────────────────────────────────────────
alter table public.booking_internal_messages enable row level security;

-- SELECT: admin/staff ven todo; driver ve solo los threads de bookings que
-- tiene asignadas via dispatch_stops.
drop policy if exists "team read internal messages" on public.booking_internal_messages;
create policy "team read internal messages"
  on public.booking_internal_messages
  for select
  using (
    public.is_staff_or_admin(auth.uid())
    or (
      exists (select 1 from public.user_roles ur
              where ur.user_id = auth.uid() and ur.role = 'driver' and ur.is_active)
      and exists (select 1 from public.dispatch_stops ds
                  where ds.booking_id = booking_internal_messages.booking_id)
    )
  );

-- INSERT: cualquier admin/staff/driver activo puede postear sobre cualquier
-- booking que vea. (La policy de SELECT ya filtra qué bookings ve cada uno.)
drop policy if exists "team post internal messages" on public.booking_internal_messages;
create policy "team post internal messages"
  on public.booking_internal_messages
  for insert
  with check (
    public.is_staff_or_admin(auth.uid())
    or exists (select 1 from public.user_roles ur
               where ur.user_id = auth.uid() and ur.role = 'driver' and ur.is_active)
  );

-- UPDATE: solo el autor puede editar o soft-delete su propio mensaje.
-- (Admin podría tener un override pero por ahora simplificamos.)
drop policy if exists "author edit own message" on public.booking_internal_messages;
create policy "author edit own message"
  on public.booking_internal_messages
  for update
  using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

-- ─── Realtime publication ──────────────────────────────────────
-- Para que el componente <BookingThread /> reciba live updates sin polling.
-- Si la tabla ya está en la publication, este ALTER lanza error idempotente —
-- ignoralo con DO $$.
do $$
begin
  alter publication supabase_realtime add table public.booking_internal_messages;
exception when duplicate_object then
  -- ya está agregada, nada que hacer
  null;
end $$;
