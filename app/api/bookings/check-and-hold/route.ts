// POST /api/bookings/check-and-hold
// Body: { product_slug | product_id, event_date, event_end_date?, start_time?,
//         end_time?, customer: { first_name, last_name, email, phone?, address? } }
//
// Supports MULTI-DAY rentals: if event_end_date > event_date, all days in
// range must be available and total = price_per_day × num_days.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getPaymentIntentTenantParams } from "@/lib/stripe/connect";
import { multiDayTotal, multiDayBreakdown, applyCoupon } from "@/lib/pricing";
import { redeemPoints as doRedeemPoints } from "@/lib/loyalty";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const HOLD_MINUTES = 15;
const MAX_DAYS = 14;

const BodySchema = z
  .object({
    product_slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    product_id: z.string().uuid().optional(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    event_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    customer: z.object({
      first_name: z.string().min(1).max(100),
      last_name: z.string().min(1).max(100),
      email: z.string().email(),
      phone: z.string().max(40).optional(),
      address: z.string().max(500).optional(),
    }),
    coupon_code: z.string().max(50).optional(),
    gift_card_code: z.string().max(50).optional(),
    // surface_type values come from the tenant's setup_surfaces table —
    // any lowercase slug is allowed; validated against active rows server-side.
    surface_type: z
      .string()
      .regex(/^[a-z0-9][a-z0-9_-]*$/)
      .min(2)
      .max(40)
      .nullable()
      .optional(),
    needs_power_supply: z.boolean().optional(),
    damage_protection: z.boolean().optional(),
    addons: z
      .array(
        z.object({
          product_id: z.string().uuid(),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .optional(),
    notes: z.string().max(2000).nullable().optional(),
    redeem_points: z.number().int().min(0).optional(),
    ghl_contact_id: z.string().optional(),
    ghl_opportunity_id: z.string().optional(),
    waiver_signature: z
      .object({
        agreed: z.boolean(),
        signed_name: z.string().min(2).max(200),
      })
      .optional()
      .nullable(),
    coi_request: z
      .object({
        venue_name: z.string().min(1).max(200),
        venue_address: z.string().max(500).optional().nullable(),
        additional_insured: z.string().max(300).optional().nullable(),
        special_instructions: z.string().max(1000).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .refine((d) => d.product_slug || d.product_id, {
    message: "product_slug or product_id is required",
  });

/** Return all ISO date strings from start to end inclusive. */
function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (e < s) return [];
  const cur = new Date(s);
  while (cur <= e) {
    out.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function POST(request: Request) {
  // Rate limit: 10 booking attempts per IP per minute. Prevents inventory
  // hold spam + Stripe intent churn.
  const ip = clientIp(request);
  const rl = await rateLimit(`book:${ip}`, { max: 10, windowSeconds: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please slow down and try again in a minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const startDate = parsed.data.event_date;
  const endDate = parsed.data.event_end_date || startDate;

  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 }
    );
  }

  const days = datesInRange(startDate, endDate);
  if (days.length === 0 || days.length > MAX_DAYS) {
    return NextResponse.json(
      { error: `Rental range must be 1–${MAX_DAYS} days` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Load lead time + waiver settings together
  const { data: settingRows } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [
      "min_booking_lead_hours",
      "waiver_enabled",
      "waiver_title",
      "waiver_text",
    ]);
  const settingMap = new Map(
    (settingRows as { key: string; value: string }[] | null || []).map((s) => [s.key, s.value]),
  );
  const minLeadHours = parseInt((settingMap.get("min_booking_lead_hours") as string) || "48", 10) || 48;
  const waiverEnabled = (settingMap.get("waiver_enabled") || "true").toLowerCase() !== "false";
  const waiverTitle = settingMap.get("waiver_title") || "Liability Waiver";
  const waiverText = settingMap.get("waiver_text") || "";

  // If waiver is enabled, validate the signature payload
  if (waiverEnabled) {
    const sig = parsed.data.waiver_signature;
    if (!sig || !sig.agreed) {
      return NextResponse.json(
        { error: "You must read and agree to the liability waiver before booking." },
        { status: 400 },
      );
    }
    if (!sig.signed_name || sig.signed_name.trim().length < 2) {
      return NextResponse.json(
        { error: "Please type your full legal name as your signature." },
        { status: 400 },
      );
    }
  }
  if (minLeadHours > 0) {
    const startDt = new Date(`${startDate}T09:00:00`);
    const hoursUntil = (startDt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < minLeadHours) {
      return NextResponse.json(
        {
          error: `Bookings require at least ${minLeadHours}h notice. Pick a later date or call (904) 584-3047 for last minute reservations.`,
        },
        { status: 400 }
      );
    }
  }

  // 1. Resolve product
  let productQuery = supabase
    .from("products")
    .select("id, name, slug, price_per_day, stock, is_active, tax_exempt");

  if (parsed.data.product_id) {
    productQuery = productQuery.eq("id", parsed.data.product_id);
  } else {
    productQuery = productQuery.eq("slug", parsed.data.product_slug!);
  }

  const { data: product, error: prodErr } = await productQuery.single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.is_active) {
    return NextResponse.json(
      { error: "Product currently unavailable" },
      { status: 409 }
    );
  }

  // 2. Check ALL days in range for blocks
  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("blocked_date, reason")
    .eq("product_id", product.id)
    .in("blocked_date", days);

  if (blocked && blocked.length > 0) {
    return NextResponse.json(
      {
        error: `Date${blocked.length > 1 ? "s" : ""} blocked in your range`,
        blocked_dates: blocked.map((b) => b.blocked_date),
        reason: blocked[0].reason,
      },
      { status: 409 }
    );
  }

  // 3. Check ALL days for existing bookings (respect stock)
  const nowISO = new Date().toISOString();
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("id, event_date, event_end_date, booking_status, hold_expires_at")
    .eq("product_id", product.id)
    .lte("event_date", endDate)
    .or(`event_end_date.gte.${startDate},and(event_end_date.is.null,event_date.gte.${startDate})`)
    .in("booking_status", ["pending_payment", "confirmed", "delivered"]);

  // Build count-per-day, filtering expired holds
  const occupiedByDay: Record<string, number> = {};
  for (const b of activeBookings || []) {
    if (
      b.booking_status === "pending_payment" &&
      b.hold_expires_at &&
      b.hold_expires_at < nowISO
    ) {
      continue;
    }
    const bStart = b.event_date;
    const bEnd = b.event_end_date || b.event_date;
    for (const day of datesInRange(bStart, bEnd)) {
      if (day >= startDate && day <= endDate) {
        occupiedByDay[day] = (occupiedByDay[day] || 0) + 1;
      }
    }
  }

  const conflictDays = Object.entries(occupiedByDay)
    .filter(([_, count]) => count >= product.stock)
    .map(([day]) => day);

  if (conflictDays.length > 0) {
    return NextResponse.json(
      {
        error: "Some days in your range are already booked",
        conflict_dates: conflictDays,
      },
      { status: 409 }
    );
  }

  // 4. Calculate subtotal — multi-day with optional weekend pricing
  // Per-day breakdown: weekday or weekend rate, with 30% surcharge on day 2+
  const { total: productSubtotal, breakdown: dayBreakdown } = multiDayBreakdown(
    days,
    product.price_per_day,
    (product as any).weekend_price_per_day || null,
  );
  // Day-2 surcharge — used for the overnight_free coupon type
  const day2SurchargeCents =
    dayBreakdown.length >= 2 ? dayBreakdown[1].appliedPriceCents : 0;

  // Power Supply add-on (flat per-day, no surcharge — it's an operational fee)
  let powerSupplyCents = 0;
  if (parsed.data.needs_power_supply) {
    const { data: addonProduct } = await supabase
      .from("products")
      .select("price_per_day")
      .eq("slug", "power-supply")
      .eq("is_addon", true)
      .eq("is_active", true)
      .maybeSingle();
    if (addonProduct) {
      powerSupplyCents = addonProduct.price_per_day * days.length;
    } else {
      // Fallback: hardcoded $150/day if product missing in DB
      powerSupplyCents = 15000 * days.length;
    }
  }

  // Customer-selected addons (chairs, tables, etc.) — flat per-day × qty × days
  let addonsTotal = 0;
  const addonLineItems: Array<{
    product_id: string;
    slug: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    tax_exempt: boolean;
  }> = [];
  if (parsed.data.addons && parsed.data.addons.length > 0) {
    const addonIds = parsed.data.addons.map((a) => a.product_id);
    const { data: addonProducts } = await supabase
      .from("products")
      .select("id, slug, name, price_per_day, tax_exempt")
      .in("id", addonIds)
      .eq("is_active", true)
      .eq("is_addon", true);

    for (const a of parsed.data.addons) {
      const p = (addonProducts as any[] || []).find((x) => x.id === a.product_id);
      if (!p) continue; // silently skip unknown/inactive addons
      const lineTotal = p.price_per_day * a.quantity * days.length;
      addonLineItems.push({
        product_id: p.id,
        slug: p.slug,
        name: p.name,
        quantity: a.quantity,
        unit_price_cents: p.price_per_day,
        line_total_cents: lineTotal,
        tax_exempt: !!p.tax_exempt,
      });
      addonsTotal += lineTotal;
    }
  }

  // Damage protection (one-time fee, not per-day). Lookup setting for price.
  let protectionCents = 0;
  if (parsed.data.damage_protection) {
    const { data: priceSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "damage_protection_price_cents")
      .maybeSingle();
    protectionCents = parseInt((priceSetting?.value as string) || "2500", 10) || 2500;
  }

  const subtotal = productSubtotal + powerSupplyCents + addonsTotal + protectionCents;

  // Apply coupon if provided
  let totalAmount = subtotal;
  let appliedCouponCode: string | null = null;
  let discountAmount = 0;

  if (parsed.data.coupon_code) {
    const code = parsed.data.coupon_code.trim().toUpperCase();
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .ilike("code", code)
      .maybeSingle();

    if (coupon && coupon.is_active) {
      const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
      const usedUp = coupon.max_uses != null && coupon.current_uses >= coupon.max_uses;
      if (!expired && !usedUp) {
        const { total, discount, rejected } = applyCoupon(
          subtotal,
          {
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
          },
          {
            isTwoDayRental: days.length === 2,
            overnightSurchargeCents: day2SurchargeCents,
          },
        );
        if (rejected) {
          return NextResponse.json({ error: rejected }, { status: 400 });
        }
        totalAmount = total;
        discountAmount = discount;
        appliedCouponCode = coupon.code;
      }
    }
  }

  // 4a-2. Apply gift card if code provided
  let giftCardCodeApplied: string | null = null;
  let giftCardCents = 0;
  if (parsed.data.gift_card_code) {
    const code = parsed.data.gift_card_code.trim().toUpperCase();
    const { data: card } = await supabase
      .from("gift_cards")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (card && card.is_active && card.balance_cents > 0) {
      const expired = card.expires_at && new Date(card.expires_at) < new Date();
      if (!expired) {
        const apply = Math.min(card.balance_cents, totalAmount);
        if (apply > 0) {
          giftCardCents = apply;
          giftCardCodeApplied = card.code;
          totalAmount = Math.max(0, totalAmount - apply);
          discountAmount += apply;
        }
      }
    }
  }

  // 4b. Apply loyalty points redemption (if user is logged in + requested)
  let pointsRedeemed = 0;
  let pointsDiscountCents = 0;
  if (parsed.data.redeem_points && parsed.data.redeem_points > 0) {
    const authClient = createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (authUser) {
      const r = await doRedeemPoints(
        authUser.id,
        parsed.data.redeem_points,
        null,
        totalAmount,
      );
      if (r.error) {
        return NextResponse.json({ error: r.error }, { status: 400 });
      }
      pointsRedeemed = r.points_used;
      pointsDiscountCents = r.discount_cents;
      totalAmount = Math.max(0, totalAmount - pointsDiscountCents);
      // Merge with existing discount for tracking
      discountAmount += pointsDiscountCents;
    }
  }

  // 4d. Apply sales tax (per-tenant config from site_settings).
  // Tax is calculated on the TAXABLE base (after discounts + gift cards +
  // point redemption), so the customer doesn't pay tax on freebies.
  // Products/addons marked tax_exempt contribute to total but NOT to the
  // taxable base — their share of any discount is also excluded pro-rata.
  let taxCents = 0;
  {
    const { data: taxRows } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["tax_enabled", "tax_rate_percent"]);
    const taxMap = new Map<string, string>(
      ((taxRows as any[]) || []).map((r) => [String(r.key), String(r.value)]),
    );
    const taxEnabled = (taxMap.get("tax_enabled") || "false").toLowerCase() === "true";
    const ratePercent = Number.parseFloat(taxMap.get("tax_rate_percent") || "0") || 0;
    if (taxEnabled && ratePercent > 0 && totalAmount > 0) {
      // Compute taxable share of the gross subtotal (before discounts).
      // Primary product: skip if tax_exempt.
      const primaryTaxable = product.tax_exempt ? 0 : productSubtotal;
      // Addons: filter exempt ones from the gross addon total
      const addonsTaxable = (addonLineItems || []).reduce((s: number, a: any) => {
        return a?.tax_exempt ? s : s + (Number(a.line_total_cents) || 0);
      }, 0);
      // Power supply and damage protection: taxable by default
      const grossSubtotalBeforeDiscount =
        productSubtotal + powerSupplyCents + addonsTotal + protectionCents;
      const taxableGross =
        primaryTaxable + addonsTaxable + powerSupplyCents + protectionCents;
      // Pro-rate any discount/redemption to taxable share, then add tax on the rest
      const taxableShare =
        grossSubtotalBeforeDiscount > 0
          ? (taxableGross / grossSubtotalBeforeDiscount) * (grossSubtotalBeforeDiscount - totalAmount)
          : 0;
      const taxableBase = Math.max(0, taxableGross - taxableShare);
      taxCents = Math.round((taxableBase * ratePercent) / 100);
      totalAmount = totalAmount + taxCents;
    }
  }

  // 5. Create booking with hold
  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();

  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      ghl_contact_id: parsed.data.ghl_contact_id || null,
      ghl_opportunity_id: parsed.data.ghl_opportunity_id || null,
      customer_first_name: parsed.data.customer.first_name,
      customer_last_name: parsed.data.customer.last_name,
      customer_email: parsed.data.customer.email,
      customer_phone: parsed.data.customer.phone || null,
      customer_address: parsed.data.customer.address || null,
      event_date: startDate,
      event_end_date: endDate,
      start_time: parsed.data.start_time || null,
      end_time: parsed.data.end_time || null,
      product_id: product.id,
      product_name: product.name,
      total_amount: totalAmount,
      tax_cents: taxCents,
      coupon_code: appliedCouponCode,
      discount_amount: discountAmount,
      surface_type: parsed.data.surface_type || null,
      needs_power_supply: parsed.data.needs_power_supply || false,
      power_supply_cents: powerSupplyCents,
      damage_protection_purchased: parsed.data.damage_protection || false,
      damage_protection_cents: protectionCents,
      addons: addonLineItems,
      addons_total_cents: addonsTotal,
      gift_card_code: giftCardCodeApplied,
      gift_card_amount_cents: giftCardCents,
      notes: parsed.data.notes || null,
      stripe_payment_status: "pending",
      booking_status: "pending_payment",
      hold_expires_at: holdExpiresAt,
    })
    .select("id, tenant_id")
    .single();

  if (bookErr || !booking) {
    return NextResponse.json(
      { error: "Failed to create booking", details: bookErr?.message },
      { status: 500 }
    );
  }

  // 5b1. Persist COI request if customer asked for one
  if (parsed.data.coi_request && parsed.data.coi_request.venue_name) {
    const coi = parsed.data.coi_request;
    const { error: coiErr } = await supabase.from("coi_requests").insert({
      booking_id: booking.id,
      venue_name: coi.venue_name.trim(),
      venue_address: coi.venue_address?.trim() || null,
      additional_insured: coi.additional_insured?.trim() || null,
      special_instructions: coi.special_instructions?.trim() || null,
      requested_by_email: parsed.data.customer.email,
      status: "requested",
    });
    if (coiErr) {
      // Non-fatal — admin can manually create from booking detail
      console.error("[coi insert failed, non-fatal]", coiErr);
    }
  }

  // 5b. Persist signed waiver (snapshot the exact text the customer agreed to)
  if (waiverEnabled && parsed.data.waiver_signature) {
    const hdrs = headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      null;
    const userAgent = hdrs.get("user-agent") || null;
    const { error: waiverErr } = await supabase.from("booking_waivers").insert({
      booking_id: booking.id,
      signed_name: parsed.data.waiver_signature.signed_name.trim(),
      signed_email: parsed.data.customer.email,
      ip_address: ipAddress,
      user_agent: userAgent,
      waiver_title_snapshot: waiverTitle,
      waiver_text_snapshot: waiverText,
    });
    if (waiverErr) {
      // Don't fail the booking — log and continue. The signed checkbox is
      // already evidence of intent. Admin can request re-sign if needed.
      console.error("[waiver insert failed, non-fatal]", waiverErr);
    }
  }

  // 6. Stripe Payment Intent
  let clientSecret: string | null = null;
  let paymentIntentId: string | null = null;
  let fullyDiscounted = false;

  // If total is below Stripe's $0.50 minimum (e.g. 100%-off coupon or
  // gift card covers everything), skip Stripe entirely and mark the
  // booking as paid + confirmed. No card needed.
  if (totalAmount < 50) {
    fullyDiscounted = true;
    await supabase
      .from("bookings")
      .update({
        stripe_payment_status: "paid",
        booking_status: "confirmed",
        payment_method: appliedCouponCode
          ? `coupon:${appliedCouponCode}`
          : giftCardCodeApplied
            ? `gift_card:${giftCardCodeApplied}`
            : "promo",
        customer_confirmed_at: new Date().toISOString(),
      })
      .eq("id", booking.id);
  } else if (isStripeConfigured()) {
    try {
      const stripe = getStripe();

      // Multi-tenant: if this tenant has a Stripe Connect account, route
      // payment directly to their bank (destination charge). Otherwise
      // (legacy IAF), direct charge on platform Stripe.
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("stripe_account_id")
        .eq("id", booking.tenant_id)
        .single();
      const tenantConnectParams = getPaymentIntentTenantParams(
        (tenantRow as any)?.stripe_account_id || null,
      );

      const intent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `${product.name} rental — ${startDate}${endDate !== startDate ? ` to ${endDate}` : ""} (${days.length} day${days.length > 1 ? "s" : ""})`,
        metadata: {
          booking_id: booking.id,
          product_id: product.id,
          product_slug: product.slug,
          event_date: startDate,
          event_end_date: endDate,
          days: String(days.length),
          customer_email: parsed.data.customer.email,
          tenant_id: booking.tenant_id,
        },
        receipt_email: parsed.data.customer.email,
        ...tenantConnectParams,
      });

      clientSecret = intent.client_secret;
      paymentIntentId = intent.id;

      await supabase
        .from("bookings")
        .update({ stripe_payment_intent_id: paymentIntentId })
        .eq("id", booking.id);
    } catch (e: any) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      return NextResponse.json(
        { error: "Payment setup failed", details: e.message },
        { status: 500 }
      );
    }
  }

  // Decrement gift card balance + log redemption (best-effort)
  if (giftCardCodeApplied && giftCardCents > 0 && booking?.id) {
    try {
      const { data: card } = await supabase
        .from("gift_cards")
        .select("id, balance_cents")
        .eq("code", giftCardCodeApplied)
        .single();
      if (card) {
        const newBalance = Math.max(0, card.balance_cents - giftCardCents);
        const updates: any = { balance_cents: newBalance };
        if (newBalance === 0) updates.fully_redeemed_at = new Date().toISOString();
        await supabase.from("gift_cards").update(updates).eq("id", card.id);
        await supabase.from("gift_card_redemptions").insert({
          gift_card_id: card.id,
          booking_id: booking.id,
          amount_cents: giftCardCents,
        });
      }
    } catch (e) {
      console.error("[gift card redemption failed]", e);
    }
  }

  // Increment coupon usage (best-effort — don't block booking)
  if (appliedCouponCode) {
    try {
      const { data: c } = await supabase
        .from("coupons")
        .select("current_uses")
        .eq("code", appliedCouponCode)
        .single();
      if (c) {
        await supabase
          .from("coupons")
          .update({ current_uses: (c.current_uses || 0) + 1 })
          .eq("code", appliedCouponCode);
      }
    } catch {
      // ignore — booking already saved, counter is non-critical
    }
  }

  return NextResponse.json({
    booking_id: booking.id,
    hold_id: booking.id,
    hold_expires_at: holdExpiresAt,
    subtotal,
    discount: discountAmount,
    amount: totalAmount,
    coupon_code: appliedCouponCode,
    days: days.length,
    event_date: startDate,
    event_end_date: endDate,
    currency: "usd",
    product_name: product.name,
    client_secret: clientSecret,
    payment_intent_id: paymentIntentId,
    fully_discounted: fullyDiscounted,
  });
}
