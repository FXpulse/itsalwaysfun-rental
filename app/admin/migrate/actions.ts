"use server";

import postgres from "postgres";

const ONE_TIME_TOKEN = "iaf-migrate-2026-x7Mp9qR3kT8vN5wY";

const MIGRATIONS = `
-- bookings: add every column the app expects (idempotent)
alter table public.bookings add column if not exists ghl_contact_id text;
alter table public.bookings add column if not exists ghl_opportunity_id text;
alter table public.bookings add column if not exists payment_method text;
alter table public.bookings add column if not exists event_end_date date;
alter table public.bookings add column if not exists start_time time;
alter table public.bookings add column if not exists end_time time;
alter table public.bookings add column if not exists coupon_code text;
alter table public.bookings add column if not exists discount_amount int not null default 0;
alter table public.bookings add column if not exists surface_type text;
alter table public.bookings add column if not exists needs_power_supply boolean not null default false;
alter table public.bookings add column if not exists power_supply_cents int not null default 0;
alter table public.bookings add column if not exists customer_confirmed_at timestamptz;
alter table public.bookings add column if not exists delivery_checked_at timestamptz;
alter table public.bookings add column if not exists delivery_checked_by text;
alter table public.bookings add column if not exists addons jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists addons_total_cents int not null default 0;
alter table public.bookings add column if not exists damage_protection_purchased boolean not null default false;
alter table public.bookings add column if not exists damage_protection_cents int not null default 0;
alter table public.bookings add column if not exists gift_card_code text;
alter table public.bookings add column if not exists gift_card_amount_cents int not null default 0;
alter table public.bookings add column if not exists hold_expires_at timestamptz;
alter table public.bookings add column if not exists cancelled_due_to_weather boolean not null default false;
alter table public.bookings add column if not exists notes text;

-- products: same defensive additions
alter table public.products add column if not exists is_addon boolean not null default false;
alter table public.products add column if not exists cost_cents int not null default 0;
alter table public.products add column if not exists weekend_price_per_day int;
create index if not exists products_is_addon_idx on public.products(is_addon);
`;

export async function runPendingMigrations(token: string): Promise<{
  ok: boolean;
  error?: string;
  applied?: string[];
  refreshed?: boolean;
}> {
  if (token !== ONE_TIME_TOKEN) {
    return { ok: false, error: "Invalid token" };
  }

  const connStr =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.SUPABASE_DB_URL;

  if (!connStr) {
    return {
      ok: false,
      error:
        "No DATABASE_URL env var set. Add one in Vercel → Settings → Env Vars. Get the value from Supabase → Project Settings → Database → Connection string → 'Transaction' pooler.",
    };
  }

  const sql = postgres(connStr, { max: 1, prepare: false });
  const applied: string[] = [];
  try {
    // Run each statement separately so we can track what worked
    const statements = MIGRATIONS.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt);
        applied.push(stmt.split("\n")[0].slice(0, 80) + "...");
      } catch (e: any) {
        applied.push(`❌ ${stmt.slice(0, 80)}... → ${e.message}`);
      }
    }

    // Force PostgREST to reload schema cache so the API sees new columns
    let refreshed = false;
    try {
      await sql.unsafe("notify pgrst, 'reload schema'");
      refreshed = true;
    } catch {}

    return { ok: true, applied, refreshed };
  } catch (e: any) {
    return { ok: false, error: e.message };
  } finally {
    await sql.end();
  }
}
