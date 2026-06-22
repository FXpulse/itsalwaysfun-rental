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
  // Slug constraint: ^[a-z0-9][a-z0-9-]*[a-z0-9]$ — lowercase + alphanumeric + dashes only.
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, "");
  const slug = `${safePrefix}-${ts}-${tenantCounter}`;
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      slug,
      business_name: `Test Tenant ${slug}`,
      owner_email: `owner-${slug}@test.local`,
      plan: "starter",
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
  price_per_day?: number;
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
      price_per_day: opts.price_per_day ?? 15000,
      weekend_price_per_day: opts.weekend_price_per_day ?? 17500,
      stock: 5,
      is_active: true,
      category: "Bounce Houses",
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

export interface TestCouponOptions {
  code?: string;
  discount_type?: "percent" | "fixed";
  discount_value?: number;
  max_uses?: number | null;
  current_uses?: number;
  is_active?: boolean;
  expires_at?: string | null;
}

export async function createTestCoupon(
  tenantId: string,
  opts: TestCouponOptions = {},
): Promise<{ id: string; code: string }> {
  const supabase = testClient();
  const code = opts.code || `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data, error } = await supabase
    .from("coupons")
    .insert({
      tenant_id: tenantId,
      code,
      description: "Integration test coupon",
      discount_type: opts.discount_type || "percent",
      discount_value: opts.discount_value ?? 10,
      max_uses: opts.max_uses === undefined ? null : opts.max_uses,
      current_uses: opts.current_uses ?? 0,
      is_active: opts.is_active ?? true,
      expires_at: opts.expires_at ?? null,
    })
    .select("id, code")
    .single();
  if (error || !data) {
    throw new Error(`createTestCoupon failed: ${error?.message}`);
  }
  return { id: data.id as string, code: data.code as string };
}

export async function getCouponUses(couponId: string): Promise<number> {
  const supabase = testClient();
  const { data } = await supabase
    .from("coupons")
    .select("current_uses")
    .eq("id", couponId)
    .single();
  return (data?.current_uses as number) ?? 0;
}

export interface TestGiftCardOptions {
  code?: string;
  balance_cents?: number;
  is_active?: boolean;
  expires_at?: string | null;
}

export async function createTestGiftCard(
  tenantId: string,
  opts: TestGiftCardOptions = {},
): Promise<{ id: string; code: string }> {
  const supabase = testClient();
  const code = opts.code || `GIFT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data, error } = await supabase
    .from("gift_cards")
    .insert({
      tenant_id: tenantId,
      code,
      balance_cents: opts.balance_cents ?? 10000,
      original_amount_cents: opts.balance_cents ?? 10000,
      is_active: opts.is_active ?? true,
      expires_at: opts.expires_at ?? null,
      purchaser_email: `purchaser-${Date.now()}@test.local`,
      recipient_email: `recipient-${Date.now()}@test.local`,
    })
    .select("id, code")
    .single();
  if (error || !data) {
    throw new Error(`createTestGiftCard failed: ${error?.message}`);
  }
  return { id: data.id as string, code: data.code as string };
}

export async function getGiftCardBalance(cardId: string): Promise<number> {
  const supabase = testClient();
  const { data } = await supabase
    .from("gift_cards")
    .select("balance_cents")
    .eq("id", cardId)
    .single();
  return (data?.balance_cents as number) ?? 0;
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
