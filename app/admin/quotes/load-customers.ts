// Aggregate unique customers from the bookings table (no dedicated `customers`
// table — customers are derived). Returns a deduped, sorted list for the
// "pick existing customer" dropdown in the quote editor.

import { createAdminClient } from "@/lib/supabase/admin";
import type { QuoteCustomer } from "./QuoteEditor";

interface BookingRow {
  customer_email: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  created_at: string;
}

export async function loadQuoteCustomers(): Promise<QuoteCustomer[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "customer_email, customer_first_name, customer_last_name, customer_phone, customer_address, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = (data as BookingRow[]) || [];
  const map = new Map<string, QuoteCustomer>();

  for (const r of rows) {
    const email = (r.customer_email || "").toLowerCase().trim();
    if (!email) continue;
    // First row wins (we're sorted by created_at DESC → newest booking has freshest contact info)
    if (map.has(email)) continue;
    map.set(email, {
      id: email,  // use email as stable id since there's no customer PK
      first_name: r.customer_first_name || "",
      last_name: r.customer_last_name || "",
      email,
      phone: r.customer_phone || null,
      address: r.customer_address || null,
    });
  }

  // Sort by last name asc for the dropdown
  return Array.from(map.values()).sort((a, b) => {
    const la = (a.last_name || "").toLowerCase();
    const lb = (b.last_name || "").toLowerCase();
    if (la !== lb) return la.localeCompare(lb);
    return (a.first_name || "").toLowerCase().localeCompare((b.first_name || "").toLowerCase());
  });
}
