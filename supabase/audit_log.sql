-- Admin audit log: who did what, when. Captures destructive + sensitive
-- actions so you can answer "did Maria refund that booking? when?" without
-- spelunking through DB.
--
-- Server actions call logAuditEvent() (lib/audit.ts) — this table is never
-- written directly from client code.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,                   -- who did it
  user_role text,                             -- admin/staff/driver at time of action
  action text not null,                       -- 'booking.refunded', 'gift_card.deactivated', etc.
  entity_type text,                           -- 'booking', 'gift_card', 'payout_request'...
  entity_id text,                             -- the row id (text to support non-uuid like booking_id strings)
  details jsonb,                              -- arbitrary context (old vs new values, amounts, reasons)
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_user_idx
  on public.admin_audit_log(user_email, created_at desc);
create index if not exists admin_audit_log_entity_idx
  on public.admin_audit_log(entity_type, entity_id, created_at desc);
create index if not exists admin_audit_log_action_idx
  on public.admin_audit_log(action, created_at desc);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

-- Admins can read everything. Staff can read their own.
drop policy if exists "admin read all audit log" on public.admin_audit_log;
create policy "admin read all audit log"
  on public.admin_audit_log for select
  using (public.is_admin(auth.uid()));

drop policy if exists "staff read own audit log" on public.admin_audit_log;
create policy "staff read own audit log"
  on public.admin_audit_log for select
  using (
    public.is_staff_or_admin(auth.uid())
    and lower(user_email) = lower(coalesce(auth.email(), ''))
  );

-- Inserts come from server actions (service role bypasses RLS), but allow
-- any authenticated user to insert their own row as a safety net.
drop policy if exists "users insert own audit events" on public.admin_audit_log;
create policy "users insert own audit events"
  on public.admin_audit_log for insert
  with check (lower(user_email) = lower(coalesce(auth.email(), '')));
