/**
 * Test fixtures — reusable across integration tests.
 *
 * Cada test crea su propio tenant aislado via createTestTenant() para que
 * los tests puedan correr en paralelo sin pisarse data. cleanupTenant()
 * cascada-borra todo lo que cuelga del tenant via FK ON DELETE CASCADE.
 *
 * No carga el módulo real `@/lib/tenant/scope` — usa el service-role client
 * directo para tener acceso cross-tenant sin restricciones.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  throw new Error(
    "Integration tests need TEST_SUPABASE_URL + TEST_SUPABASE_SERVICE_ROLE_KEY. " +
      "Run `supabase start` and copy from `supabase status`, or use a dedicated test project.",
  );
}

export function testClient(): SupabaseClient {
  return createClient(URL!, KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let tenantCounter = 0;

/** Crea un tenant aislado para el test. Retorna su UUID. */
export async function createTestTenant(prefix = "test"): Promise<string> {
  const supabase = testClient();
  tenantCounter++;
  const ts = Date.now();
  const slug = `${prefix}-${ts}-${tenantCounter}`;
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      slug,
      business_name: `Test Tenant ${slug}`,
      owner_email: `owner-${slug}@test.local`,
      plan: "trial",
      trial_ends_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createTestTenant failed: ${error?.message}`);
  }
  return data.id as string;
}

/** Borra el tenant + todo lo que cuelga via CASCADE. */
export async function cleanupTenant(tenantId: string): Promise<void> {
  const supabase = testClient();
  await supabase.from("tenants").delete().eq("id", tenantId);
}

export interface TestProductOptions {
  name?: string;
  base_price_cents?: number;
  weekend_price_per_day?: number;
}

export async function createTestProduct(
  tenantId: string,
  opts: TestProductOptions = {},
): Promise<{ id: string; slug: string }> {
  const supabase = testClient();
  const slug = `bouncer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: tenantId,
      slug,
      name: opts.name || "Test Bouncer",
      description: "Integration test product",
      base_price_cents: opts.base_price_cents ?? 15000,
      weekend_price_per_day: opts.weekend_price_per_day ?? 17500,
      stock: 5,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createTestProduct failed: ${error?.message}`);
  }
  return { id: data.id as string, slug };
}

export interface TestBookingOptions {
  event_date?: string;
  total_amount?: number;
  customer_email?: string;
  stripe_payment_status?: "pending" | "paid" | "failed" | "refunded";
  booking_status?: "pending_payment" | "confirmed" | "delivered" | "completed" | "cancelled";
}

export async function createTestBooking(
  tenantId: string,
  productId: string,
  opts: TestBookingOptions = {},
): Promise<string> {
  const supabase = testClient();
  const event_date = opts.event_date || new Date(Date.now() + 14 * 86400_000).toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      tenant_id: tenantId,
      product_id: productId,
      product_name: "Test Bouncer",
      customer_first_name: "Test",
      customer_last_name: "Customer",
      customer_email: opts.customer_email || `customer-${Date.now()}@test.local`,
      event_date,
      start_time: "10:00",
      end_time: "16:00",
      total_amount: opts.total_amount ?? 17500,
      booking_status: opts.booking_status || "pending_payment",
      stripe_payment_status: opts.stripe_payment_status || "pending",
      hold_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createTestBooking failed: ${error?.message}`);
  }
  return data.id as string;
}

/** Helper: cuenta cuántos emails se enviaron de un tipo dado para un booking. */
export async function getEmailsSent(bookingId: string, emailType?: string): Promise<number> {
  const supabase = testClient();
  let query = supabase
    .from("booking_emails_sent")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("success", true);
  if (emailType) {
    query = query.eq("email_type", emailType);
  }
  const { count } = await query;
  return count ?? 0;
}
