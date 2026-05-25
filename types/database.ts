// Minimal database types (manual — regenerate with `npm run supabase:types` after schema changes).

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "delivered"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  price_per_day: number;     // cents
  stock: number;
  image_url: string | null;
  ghl_listing_id: string | null;
  is_active: boolean;
  setup_area: string | null;
  actual_size: string | null;
  outlets_required: number;
  age_group: string | null;
  is_addon: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  event_date: string;        // ISO date — first day of rental
  event_end_date: string | null;  // ISO date — last day (null = single-day, same as event_date)
  start_time: string | null;
  end_time: string | null;
  product_id: string;
  product_name: string;
  total_amount: number;      // cents
  surface_type: "dirt" | "grass" | "concrete" | "paver" | "asphalt" | "other" | null;
  needs_power_supply: boolean;
  power_supply_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_payment_status: PaymentStatus;
  booking_status: BookingStatus;
  hold_expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlockedDate {
  id: string;
  product_id: string;
  blocked_date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}
