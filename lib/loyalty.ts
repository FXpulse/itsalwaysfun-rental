// Loyalty + Referrals server helpers.
// Use createAdminClient() for all DB reads/writes since these run from
// webhooks, server actions, and route handlers.

import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured } from "@/lib/email/send";
import { sendTemplated } from "@/lib/email/send-template";
import { renderReferralEmail, renderAdminPayoutAlert } from "@/lib/email/templates";
import { getTenantInfo, tenantToEmailBrand } from "@/lib/tenant/business";
import { tryGetTenantIdFromHeaders } from "@/lib/tenant/scope";

export interface LoyaltySettings {
  points_per_dollar: number;
  points_redemption_rate: number; // points needed for $1
  referral_commission_pct: number;
  min_redeem_points: number;
}

const DEFAULT_SETTINGS: LoyaltySettings = {
  points_per_dollar: 1,
  points_redemption_rate: 100,
  referral_commission_pct: 10,
  min_redeem_points: 500,
};

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .eq("category", "loyalty");

  const out = { ...DEFAULT_SETTINGS };
  for (const row of (data as any[]) || []) {
    const v = parseInt(row.value || "", 10);
    if (Number.isNaN(v)) continue;
    if (row.key === "loyalty_points_per_dollar") out.points_per_dollar = v;
    if (row.key === "loyalty_points_redemption_rate") out.points_redemption_rate = v;
    if (row.key === "referral_commission_pct") out.referral_commission_pct = v;
    if (row.key === "loyalty_min_redeem_points") out.min_redeem_points = v;
  }
  return out;
}

/** Ensure a customer_profile exists for the given user_id. Returns the
 *  referral code (creating one if needed via RPC).
 *
 *  tenantId is required. We accept it explicitly because this is often
 *  called from contexts without request headers (Stripe webhook, cron),
 *  where the proxy can't resolve a tenant from `next/headers`. When the
 *  caller IS inside a request, pass `getCurrentTenantId()` or omit and we
 *  fall back to the header — but we never silently default to IAF here. */
export async function ensureCustomerProfile(
  userId: string,
  tenantId?: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const tid = tenantId || tryGetTenantIdFromHeaders();
  if (!tid) {
    console.error("ensureCustomerProfile: no tenant_id and no request context — refusing to fall back to IAF default", { userId });
    return null;
  }
  const { data, error } = await supabase.rpc("ensure_customer_profile", {
    uid: userId,
    p_tenant_id: tid,
  });
  if (error) {
    console.error("ensureCustomerProfile error", error);
    return null;
  }
  return (data as string) || null;
}

/** Find the user_id of the customer whose referral_code matches. Null if not found. */
export async function findUserByReferralCode(code: string): Promise<string | null> {
  if (!code || code.length < 4) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customer_profiles")
    .select("user_id")
    .eq("referral_code", code.toUpperCase().trim())
    .maybeSingle();
  return (data?.user_id as string) || null;
}

/** Link a newly-authed user to their referrer (called from auth callback when
 *  ref cookie is set). Idempotent — only sets if not already set. */
export async function linkReferrer(
  userId: string,
  referrerCode: string,
  tenantId?: string,
): Promise<boolean> {
  if (!userId || !referrerCode) return false;
  const referrerId = await findUserByReferralCode(referrerCode);
  if (!referrerId || referrerId === userId) return false; // can't self-refer

  await ensureCustomerProfile(userId, tenantId);

  const supabase = createAdminClient();
  // Only set if currently null (don't overwrite existing referrer)
  const { error } = await supabase
    .from("customer_profiles")
    .update({ referred_by_user_id: referrerId })
    .eq("user_id", userId)
    .is("referred_by_user_id", null);

  if (error) {
    console.error("linkReferrer error", error);
    return false;
  }
  return true;
}

/** Award loyalty points + (maybe) referral commission for a paid booking.
 *  - Looks up customer by email
 *  - If they have a portal profile: awards points
 *  - If first paid booking AND they were referred: awards commission to referrer
 *  - Idempotent per booking via the booking_id ledger constraint check below
 */
export async function awardForPaidBooking(bookingId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, tenant_id, customer_email, total_amount, tax_cents, coupon_code, stripe_payment_status, booking_status, created_at")
    .eq("id", bookingId)
    .single();
  if (!booking || booking.stripe_payment_status !== "paid") return;
  if (booking.booking_status === "cancelled") return;
  if (!booking.tenant_id) {
    console.error("awardForPaidBooking: booking missing tenant_id", { bookingId });
    return;
  }

  // Already awarded? Check ledger for booking_points entry tied to this booking.
  const { data: existing } = await supabase
    .from("loyalty_transactions")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("type", "booking_points")
    .maybeSingle();
  if (existing) return; // idempotent

  const email = (booking.customer_email || "").toLowerCase();
  if (!email) return;

  // Find auth user by email
  const { data: { users } = { users: [] } } = await supabase.auth.admin.listUsers({
    perPage: 500,
  });
  const customer = (users || []).find((u: any) => (u.email || "").toLowerCase() === email);
  if (!customer) return; // not a portal customer → no points

  await ensureCustomerProfile(customer.id, booking.tenant_id);

  const settings = await getLoyaltySettings();
  const dollars = Math.floor((booking.total_amount || 0) / 100);
  const pointsToAward = Math.max(0, dollars * settings.points_per_dollar);

  if (pointsToAward > 0) {
    // Insert ledger row
    await supabase.from("loyalty_transactions").insert({
      user_id: customer.id,
      type: "booking_points",
      points: pointsToAward,
      booking_id: bookingId,
      description: `Earned for booking on ${booking.created_at?.substring(0, 10)}`,
    });

    // Increment balance
    await supabase.rpc("increment_loyalty_points", {
      uid: customer.id,
      delta: pointsToAward,
    }).then(() => {}, async () => {
      // RPC not present — do manual update
      const { data: p } = await supabase
        .from("customer_profiles")
        .select("loyalty_points")
        .eq("user_id", customer.id)
        .single();
      if (p) {
        await supabase
          .from("customer_profiles")
          .update({ loyalty_points: (p.loyalty_points || 0) + pointsToAward })
          .eq("user_id", customer.id);
      }
    });
  }

  // Referral commission — only on FIRST paid booking for this email
  const { data: priorPaid } = await supabase
    .from("bookings")
    .select("id")
    .ilike("customer_email", email)
    .eq("stripe_payment_status", "paid")
    .neq("id", bookingId)
    .limit(1);

  if ((priorPaid || []).length > 0) return; // not first paid → no commission

  // Resolve effective referrer — priority order:
  //   1. referred_by_user_id from the customer's profile (set via cookie+auth)
  //   2. referrer_user_id on the coupon used (if any)
  // Never both — first match wins. Anti-double-pay.
  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("referred_by_user_id")
    .eq("user_id", customer.id)
    .single();

  let effectiveReferrerId: string | null = profile?.referred_by_user_id || null;
  let attributionSource: "cookie" | "coupon" = "cookie";

  if (!effectiveReferrerId && booking.coupon_code) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("referrer_user_id")
      .eq("code", booking.coupon_code)
      .maybeSingle();
    if (coupon?.referrer_user_id) {
      effectiveReferrerId = coupon.referrer_user_id;
      attributionSource = "coupon";
      // Backfill the customer's profile so future queries are consistent
      await supabase
        .from("customer_profiles")
        .update({ referred_by_user_id: effectiveReferrerId })
        .eq("user_id", customer.id)
        .is("referred_by_user_id", null);
    }
  }

  if (!effectiveReferrerId) return;

  // Commission base: total_amount MINUS taxes — i.e. post-discount, pre-tax.
  // This matches business intent: the referrer earns on the sale price, not on tax we collect for the state.
  const commissionBase = Math.max(0, (booking.total_amount || 0) - (booking.tax_cents || 0));
  const commissionCents = Math.round(commissionBase * (settings.referral_commission_pct / 100));
  if (commissionCents <= 0) return;

  await ensureCustomerProfile(effectiveReferrerId, booking.tenant_id);

  await supabase.from("loyalty_transactions").insert({
    user_id: effectiveReferrerId,
    type: "referral_commission",
    commission_cents: commissionCents,
    booking_id: bookingId,
    referred_user_id: customer.id,
    description: `Commission via ${attributionSource} — first paid booking`,
  });

  // Increment commission_pending
  const { data: refProfile } = await supabase
    .from("customer_profiles")
    .select("commission_pending_cents")
    .eq("user_id", effectiveReferrerId)
    .single();
  let newPendingCents = commissionCents;
  if (refProfile) {
    newPendingCents = (refProfile.commission_pending_cents || 0) + commissionCents;
    await supabase
      .from("customer_profiles")
      .update({ commission_pending_cents: newPendingCents })
      .eq("user_id", effectiveReferrerId);
  }

  // Lookup referrer user + check threshold
  const { data: { user: referrerUser } } = await supabase.auth.admin.getUserById(
    effectiveReferrerId,
  );
  const referrerMeta = (referrerUser?.user_metadata as any) || {};

  const { data: thresholdSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "commission_payout_threshold_cents")
    .maybeSingle();
  const thresholdCents = parseInt((thresholdSetting?.value as string) || "5000", 10);
  const readyForPayout = newPendingCents >= thresholdCents;

  // 1. Fire GHL webhook (for CRM sync if configured)
  // Per-tenant GHL config — agency model. Each tenant has their own
  // sub-account Location + webhook URLs. Skip if not configured.
  try {
    const Sentry = await import("@sentry/nextjs");
    const { getTenantGhlConfig } = await import("@/lib/ghl/tenant-config");
    const ghlConfig = await getTenantGhlConfig(booking.tenant_id);
    const webhookUrl = ghlConfig?.referral_webhook_url || null;
    if (!ghlConfig?.location_id) {
      Sentry.captureMessage("GHL referral push skipped — no tenant location", {
        level: "info",
        tags: { area: "ghl", tenant_id: booking.tenant_id || "" },
        extra: { reason: "no_location" },
      });
    } else if (!webhookUrl) {
      Sentry.captureMessage("GHL referral push skipped — no referral webhook URL", {
        level: "info",
        tags: { area: "ghl", tenant_id: booking.tenant_id || "" },
        extra: { reason: "no_referral_webhook_url" },
      });
    }
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: referrerMeta.first_name || "",
          lastName: referrerMeta.last_name || "",
          email: referrerUser?.email,
          phone: referrerMeta.phone || "",
          commissionEarned: (commissionCents / 100).toFixed(2),
          referredCustomer: customer.email,
          totalPendingCommission: (newPendingCents / 100).toFixed(2),
          readyForPayout,
          source: "referral-commission-earned",
        }),
      });
    }
  } catch (e) {
    console.error("Referral webhook failed (non-fatal)", e);
  }

  // 2. Send email via Resend directly to the referrer (DB template + fallback)
  if (isEmailConfigured() && referrerUser?.email) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
    const firstName = referrerMeta.first_name || referrerUser.email.split("@")[0];

    const r = await sendTemplated({
      key: "referral_commission",
      to: referrerUser.email,
      vars: {
        firstName,
        commissionDollars: (commissionCents / 100).toFixed(2),
        referredCustomerEmail: customer.email!,
        totalPendingDollars: (newPendingCents / 100).toFixed(2),
        portalUrl: `${baseUrl}/portal/referrals`,
        readyForPayout: readyForPayout ? "true" : "",
      },
      fallback: async () => {
        const tenant = await getTenantInfo();
        return renderReferralEmail({
          firstName,
          commissionCents,
          bookingCustomerName: customer.email!,
          pendingTotalCents: newPendingCents,
          payoutThresholdCents: thresholdCents,
          portalUrl: `${baseUrl}/portal/referrals`,
          brand: tenantToEmailBrand(tenant),
        });
      },
      tags: [{ name: "type", value: "referral_commission" }],
    });
    if (!r.ok) console.error("[Resend referral send failed]", r.error);

    // 3. Alert admin if threshold reached
    if (readyForPayout) {
      const adminEmail = process.env.ADMIN_ALERT_EMAIL || "admin@itsalwaysfun.com";
      const customerName =
        `${referrerMeta.first_name || ""} ${referrerMeta.last_name || ""}`.trim() ||
        referrerUser.email;
      const adminPanelUrl = `${baseUrl}/admin/loyalty/${effectiveReferrerId}`;

      await sendTemplated({
        key: "admin_payout_alert",
        to: adminEmail,
        vars: {
          customerName,
          customerEmail: referrerUser.email,
          customerPhone: referrerMeta.phone || "",
          totalPendingDollars: (newPendingCents / 100).toFixed(2),
          adminPanelUrl,
        },
        fallback: async () => {
          const tenant = await getTenantInfo();
          return renderAdminPayoutAlert({
            customerName,
            customerEmail: referrerUser.email!,
            pendingCommissionCents: newPendingCents,
            adminUrl: adminPanelUrl,
            brand: tenantToEmailBrand(tenant),
          });
        },
        tags: [{ name: "type", value: "admin_payout_alert" }],
      });
    }
  }
}

/** Redeem points at checkout. Returns the discount in cents (capped by points
 *  available and order total). Records a negative ledger entry. */
export async function redeemPoints(
  userId: string,
  pointsToRedeem: number,
  bookingId: string | null,
  subtotalCents: number,
): Promise<{ discount_cents: number; points_used: number; error?: string }> {
  const supabase = createAdminClient();
  const settings = await getLoyaltySettings();

  if (pointsToRedeem < settings.min_redeem_points) {
    return {
      discount_cents: 0,
      points_used: 0,
      error: `Minimum ${settings.min_redeem_points} points to redeem`,
    };
  }

  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("loyalty_points")
    .eq("user_id", userId)
    .single();
  if (!profile) return { discount_cents: 0, points_used: 0, error: "No profile" };
  if (profile.loyalty_points < pointsToRedeem) {
    return {
      discount_cents: 0,
      points_used: 0,
      error: `Only ${profile.loyalty_points} points available`,
    };
  }

  // Calculate discount, cap at subtotal
  const desiredDiscountCents = Math.floor(
    (pointsToRedeem / settings.points_redemption_rate) * 100,
  );
  const cappedDiscount = Math.min(desiredDiscountCents, subtotalCents);
  // If capped, refund the difference of points
  const actualPointsUsed = Math.ceil(
    (cappedDiscount / 100) * settings.points_redemption_rate,
  );

  // Deduct points
  await supabase
    .from("customer_profiles")
    .update({ loyalty_points: profile.loyalty_points - actualPointsUsed })
    .eq("user_id", userId);

  // Ledger
  await supabase.from("loyalty_transactions").insert({
    user_id: userId,
    type: "points_redeemed",
    points: -actualPointsUsed,
    booking_id: bookingId,
    description: `Redeemed for $${(cappedDiscount / 100).toFixed(2)} discount`,
  });

  return { discount_cents: cappedDiscount, points_used: actualPointsUsed };
}
