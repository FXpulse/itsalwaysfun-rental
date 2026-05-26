// 1099-NEC compilation — sums labor payments per driver_email for a given
// calendar year, joins with their driver_tax_profile + checks the IRS
// threshold (configurable via site_settings).

import { createAdminClient } from "@/lib/supabase/admin";

export interface NinetyNineRow {
  driver_email: string;
  // From driver_tax_profiles (nullable if profile not yet set up)
  full_name: string | null;
  business_name: string | null;
  tin_last4: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  address_complete: boolean;       // true when at least line1+city+state+zip present
  w9_received_at: string | null;
  w9_storage_path: string | null;
  filed_at: string | null;         // ISO timestamp when admin marked this year filed
  // Computed from booking_expenses
  total_paid_cents: number;
  total_hours: number;
  bookings_count: number;
  expense_lines: number;
  // Threshold flag
  qualifies: boolean;              // total >= threshold (1099 must be filed)
}

export interface NinetyNineSummary {
  year: number;
  threshold_cents: number;
  drivers: NinetyNineRow[];
  total_paid_cents: number;
  qualifying_count: number;
  missing_w9_count: number;
  missing_address_count: number;
  filed_count: number;
}

export async function compute1099Year(year: number): Promise<NinetyNineSummary> {
  const supabase = createAdminClient();

  // Resolve threshold from site_settings (default $600 = 60000 cents)
  const { data: setting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "1099_nec_threshold_cents")
    .maybeSingle();
  const threshold = parseInt((setting?.value as string) || "60000", 10) || 60000;

  // Labor category keys
  const { data: cats } = await supabase
    .from("booking_expense_categories")
    .select("key")
    .eq("supports_payroll_hours", true);
  const laborKeys = ((cats as any[]) || []).map((c) => c.key);

  const fromStr = `${year}-01-01T00:00:00`;
  const toStr = `${year}-12-31T23:59:59`;

  if (laborKeys.length === 0) {
    return {
      year,
      threshold_cents: threshold,
      drivers: [],
      total_paid_cents: 0,
      qualifying_count: 0,
      missing_w9_count: 0,
      missing_address_count: 0,
      filed_count: 0,
    };
  }

  // All labor expenses in that year with a driver_email tagged
  const { data: expenses } = await supabase
    .from("booking_expenses")
    .select("driver_email, driver_hours, amount_cents, booking_id, recorded_at")
    .in("category", laborKeys)
    .not("driver_email", "is", null)
    .gte("recorded_at", fromStr)
    .lte("recorded_at", toStr);

  // Aggregate per driver
  const byDriver = new Map<
    string,
    {
      driver_email: string;
      total_paid_cents: number;
      total_hours: number;
      bookings: Set<string>;
      expense_lines: number;
    }
  >();
  for (const e of (expenses as any[]) || []) {
    const email = (e.driver_email || "").trim().toLowerCase();
    if (!email) continue;
    if (!byDriver.has(email)) {
      byDriver.set(email, {
        driver_email: email,
        total_paid_cents: 0,
        total_hours: 0,
        bookings: new Set(),
        expense_lines: 0,
      });
    }
    const d = byDriver.get(email)!;
    d.total_paid_cents += e.amount_cents || 0;
    d.total_hours += e.driver_hours || 0;
    d.expense_lines += 1;
    if (e.booking_id) d.bookings.add(e.booking_id);
  }

  if (byDriver.size === 0) {
    return {
      year,
      threshold_cents: threshold,
      drivers: [],
      total_paid_cents: 0,
      qualifying_count: 0,
      missing_w9_count: 0,
      missing_address_count: 0,
      filed_count: 0,
    };
  }

  // Join with driver_tax_profiles
  const emails = Array.from(byDriver.keys());
  const { data: profiles } = await supabase
    .from("driver_tax_profiles")
    .select(
      "driver_email, full_name, business_name, tin_last4, address_line1, address_line2, city, state, zip, notes, w9_received_at, w9_storage_path, filed_history",
    )
    .in("driver_email", emails);
  const profileByEmail = new Map<string, any>(
    ((profiles as any[]) || []).map((p) => [p.driver_email, p]),
  );

  const rows: NinetyNineRow[] = Array.from(byDriver.values()).map((d) => {
    const p = profileByEmail.get(d.driver_email);
    const addressComplete = !!(
      p?.address_line1 && p?.city && p?.state && p?.zip
    );
    const filedAt = p?.filed_history?.[String(year)] || null;
    return {
      driver_email: d.driver_email,
      full_name: p?.full_name || null,
      business_name: p?.business_name || null,
      tin_last4: p?.tin_last4 || null,
      address_line1: p?.address_line1 || null,
      address_line2: p?.address_line2 || null,
      city: p?.city || null,
      state: p?.state || null,
      zip: p?.zip || null,
      notes: p?.notes || null,
      address_complete: addressComplete,
      w9_received_at: p?.w9_received_at || null,
      w9_storage_path: p?.w9_storage_path || null,
      filed_at: filedAt,
      total_paid_cents: d.total_paid_cents,
      total_hours: Math.round(d.total_hours * 100) / 100,
      bookings_count: d.bookings.size,
      expense_lines: d.expense_lines,
      qualifies: d.total_paid_cents >= threshold,
    };
  });

  // Sort: qualifying first (descending by total), then non-qualifying
  rows.sort((a, b) => {
    if (a.qualifies !== b.qualifies) return a.qualifies ? -1 : 1;
    return b.total_paid_cents - a.total_paid_cents;
  });

  const qualifying = rows.filter((r) => r.qualifies);
  return {
    year,
    threshold_cents: threshold,
    drivers: rows,
    total_paid_cents: rows.reduce((s, r) => s + r.total_paid_cents, 0),
    qualifying_count: qualifying.length,
    missing_w9_count: qualifying.filter((r) => !r.w9_received_at).length,
    missing_address_count: qualifying.filter((r) => !r.address_complete).length,
    filed_count: qualifying.filter((r) => !!r.filed_at).length,
  };
}
