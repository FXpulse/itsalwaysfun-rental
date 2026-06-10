// Scheduled booking emails:
//   1. booking_confirmation         — immediately on payment
//   2. booking_reminder_3d          — 3 days before event_date
//   3. booking_review_request       — 1 day after event_date
//   4. booking_reengagement_90d     — 90 days after event_date (encourage rebooking)
//   5. booking_anniversary_1y       — 365 days after created_at
//
// Confirmation fires inline from Stripe webhook / mark-paid action.
// The other 4 fire from a daily cron at /api/cron/booking-emails.
// Each send is idempotent — booking_emails_sent (unique on booking_id+type)
// blocks duplicates.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplated } from "@/lib/email/send-template";
import { isEmailConfigured } from "@/lib/email/send";
import { getTenantEmailConfig } from "@/lib/email/tenant-email";
import { sendSms, isSmsConfigured } from "@/lib/sms/send";
import { renderTemplateSms } from "@/lib/email/render-template";

type EmailType =
  | "booking_confirmation"
  | "booking_reminder_3d"
  | "booking_review_request"
  | "booking_reengagement_90d"
  | "booking_anniversary_1y";

interface BookingRow {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  product_name: string;
  event_date: string;
  event_end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  total_amount: number;
  needs_power_supply: boolean | null;
  stripe_payment_status: string;
  booking_status: string;
  created_at: string;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";

/** True if already sent. */
async function alreadySent(bookingId: string, emailType: EmailType): Promise<boolean> {
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("booking_emails_sent")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("email_type", emailType)
    .maybeSingle();
  return !!data;
}

async function recordSend(
  bookingId: string,
  emailType: EmailType,
  success: boolean,
  resendId?: string,
  errorMessage?: string,
) {
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("booking_emails_sent").insert({
    booking_id: bookingId,
    email_type: emailType,
    success,
    resend_id: resendId || null,
    error_message: errorMessage || null,
  });
}

import { formatDateUS } from "./format-date";

function buildVars(b: BookingRow, extras: Record<string, any> = {}): Record<string, any> {
  return {
    firstName: b.customer_first_name,
    lastName: b.customer_last_name,
    productName: b.product_name,
    // Customer-facing dates use MM/DD/YYYY for consistency across emails
    eventDate: formatDateUS(b.event_date),
    eventEndDate: formatDateUS(b.event_end_date),
    startTime: b.start_time || "",
    endTime: b.end_time || "",
    address: b.customer_address || "",
    totalDollars: (b.total_amount / 100).toFixed(2),
    needsPowerSupply: b.needs_power_supply ? "true" : "",
    bookingPortalUrl: `${BASE_URL}/portal/bookings/${b.id}`,
    bookNextUrl: `${BASE_URL}/order-by-date`,
    bookAgainUrl: `${BASE_URL}/order-by-date`,
    lastEventDate: formatDateUS(b.event_date),
    ...extras,
  };
}

/** Fetch the tenant's important_tips for an email. Looks up the booking's
 *  tenant_id and returns both plain-text + HTML-escaped <br> versions. */
async function fetchImportantTips(tenantId: string | null | undefined): Promise<{
  importantTips: string;
  importantTipsHtml: string;
}> {
  if (!tenantId) return { importantTips: "", importantTipsHtml: "" };
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "important_tips")
    .maybeSingle();
  const text = String((data as any)?.value || "").trim();
  return {
    importantTips: text,
    importantTipsHtml: text ? text.replace(/\n/g, "<br>") : "",
  };
}

/** Send the immediate booking confirmation email + SMS. Idempotent. */
export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (!booking) return;

  const b = booking as BookingRow;

  // Email (idempotent via ledger)
  if (isEmailConfigured() && !(await alreadySent(bookingId, "booking_confirmation"))) {
    const tips = await fetchImportantTips((b as any).tenant_id);
    const tenantEmail = await getTenantEmailConfig((b as any).tenant_id);
    const r = await sendTemplated({
      key: "booking_confirmation",
      to: b.customer_email,
      from: tenantEmail.from,
      replyTo: tenantEmail.replyTo,
      vars: buildVars(b, tips),
      tags: [
        { name: "type", value: "booking_confirmation" },
        { name: "booking_id", value: bookingId },
      ],
    });
    await recordSend(bookingId, "booking_confirmation", r.ok, r.id, r.ok ? undefined : r.error);
  }

  // SMS (best-effort, separate channel — uses customer_phone if present)
  if (isSmsConfigured() && b.customer_phone) {
    const smsBody = await renderTemplateSms(
      "booking_confirmation",
      buildVars(b),
      (b as any).tenant_id,
    );
    if (smsBody) {
      await sendSms({ to: b.customer_phone, body: smsBody }).catch(() => {});
    }
  }
}

/** Scan all bookings and send any due scheduled emails. Called by daily cron. */
export async function processScheduledBookingEmails(): Promise<{
  reminder_3d: number;
  review_1d: number;
  anniversary_1y: number;
  errors: string[];
}> {
  const summary = {
    reminder_3d: 0,
    review_1d: 0,
    reengagement_90d: 0,
    anniversary_1y: 0,
    errors: [] as string[],
  };

  if (!isEmailConfigured()) {
    summary.errors.push("Email not configured");
    return summary;
  }

  const supabase = createAdminClient({ unscoped: true });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helpers
  const todayStr = today.toISOString().split("T")[0];
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(today.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

  const oneDayAgo = new Date(today);
  oneDayAgo.setDate(today.getDate() - 1);
  const oneDayAgoStr = oneDayAgo.toISOString().split("T")[0];

  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

  // ─── 1) Reminder 3 days before event ─────────────────────────────────
  // Match bookings whose event_date is exactly 3 days from today, paid, not cancelled
  {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("event_date", threeDaysStr)
      .eq("stripe_payment_status", "paid")
      .neq("booking_status", "cancelled");

    for (const b of (bookings as BookingRow[]) || []) {
      try {
        if (await alreadySent(b.id, "booking_reminder_3d")) continue;
        const tenantEmail = await getTenantEmailConfig((b as any).tenant_id);
        const r = await sendTemplated({
          key: "booking_reminder_3d",
          to: b.customer_email,
          from: tenantEmail.from,
          replyTo: tenantEmail.replyTo,
          vars: buildVars(b),
          tags: [
            { name: "type", value: "booking_reminder_3d" },
            { name: "booking_id", value: b.id },
          ],
        });
        await recordSend(b.id, "booking_reminder_3d", r.ok, r.id, r.ok ? undefined : r.error);
        if (r.ok) summary.reminder_3d++;

        // SMS reminder too (best-effort)
        if (isSmsConfigured() && b.customer_phone) {
          const smsBody = await renderTemplateSms(
            "booking_reminder_3d",
            buildVars(b),
            (b as any).tenant_id,
          );
          if (smsBody) {
            await sendSms({ to: b.customer_phone, body: smsBody }).catch(() => {});
          }
        }
      } catch (e: any) {
        summary.errors.push(`reminder_3d ${b.id}: ${e.message}`);
      }
    }
  }

  // ─── 2) Review request 1 day after event ─────────────────────────────
  {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("event_date", oneDayAgoStr)
      .eq("stripe_payment_status", "paid")
      .neq("booking_status", "cancelled");

    // Look up Google review URL from site_settings (admin can edit)
    const { data: reviewSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "google_review_url")
      .maybeSingle();
    const googleReviewUrl =
      (reviewSetting?.value as string) ||
      "https://g.page/r/itsalwaysfun/review";

    for (const b of (bookings as BookingRow[]) || []) {
      try {
        if (await alreadySent(b.id, "booking_review_request")) continue;
        const tenantEmail = await getTenantEmailConfig((b as any).tenant_id);
        const r = await sendTemplated({
          key: "booking_review_request",
          to: b.customer_email,
          from: tenantEmail.from,
          replyTo: tenantEmail.replyTo,
          vars: buildVars(b, { googleReviewUrl }),
          tags: [
            { name: "type", value: "booking_review_request" },
            { name: "booking_id", value: b.id },
          ],
        });
        await recordSend(b.id, "booking_review_request", r.ok, r.id, r.ok ? undefined : r.error);
        if (r.ok) summary.review_1d++;
      } catch (e: any) {
        summary.errors.push(`review_1d ${b.id}: ${e.message}`);
      }
    }
  }

  // ─── 3) Re-engagement 90 days after event ────────────────────────────
  // Encourage rebooking — customer's last event was 90 days ago
  {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("event_date", ninetyDaysAgoStr)
      .eq("stripe_payment_status", "paid")
      .neq("booking_status", "cancelled");

    for (const b of (bookings as BookingRow[]) || []) {
      try {
        if (await alreadySent(b.id, "booking_reengagement_90d")) continue;
        const tenantEmail = await getTenantEmailConfig((b as any).tenant_id);
        const r = await sendTemplated({
          key: "booking_reengagement_90d",
          to: b.customer_email,
          from: tenantEmail.from,
          replyTo: tenantEmail.replyTo,
          vars: buildVars(b),
          tags: [
            { name: "type", value: "booking_reengagement_90d" },
            { name: "booking_id", value: b.id },
          ],
        });
        await recordSend(b.id, "booking_reengagement_90d", r.ok, r.id, r.ok ? undefined : r.error);
        if (r.ok) summary.reengagement_90d++;
      } catch (e: any) {
        summary.errors.push(`reengagement_90d ${b.id}: ${e.message}`);
      }
    }
  }

  // ─── 4) Anniversary 1 year after booking ─────────────────────────────
  // Match bookings whose created_at falls exactly 365 days ago (or 366 for leap)
  // Window: [365 days ago start of day, 365 days ago end of day]
  {
    const yearAgoStart = new Date(today);
    yearAgoStart.setDate(today.getDate() - 365);
    const yearAgoStartStr = yearAgoStart.toISOString();
    const yearAgoEnd = new Date(yearAgoStart);
    yearAgoEnd.setDate(yearAgoStart.getDate() + 1);
    const yearAgoEndStr = yearAgoEnd.toISOString();

    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .gte("created_at", yearAgoStartStr)
      .lt("created_at", yearAgoEndStr)
      .eq("stripe_payment_status", "paid")
      .neq("booking_status", "cancelled");

    // Look up loyalty code (admin can set an evergreen LOYAL code in coupons)
    const { data: loyaltyCoupon } = await supabase
      .from("coupons")
      .select("code")
      .ilike("code", "LOYAL%")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const loyaltyCode = (loyaltyCoupon?.code as string) || "";

    for (const b of (bookings as BookingRow[]) || []) {
      try {
        if (await alreadySent(b.id, "booking_anniversary_1y")) continue;
        const r = await sendTemplated({
          key: "booking_anniversary_1y",
          to: b.customer_email,
          vars: buildVars(b, { loyaltyCode }),
          tags: [
            { name: "type", value: "booking_anniversary_1y" },
            { name: "booking_id", value: b.id },
          ],
        });
        await recordSend(b.id, "booking_anniversary_1y", r.ok, r.id, r.ok ? undefined : r.error);
        if (r.ok) summary.anniversary_1y++;
      } catch (e: any) {
        summary.errors.push(`anniversary_1y ${b.id}: ${e.message}`);
      }
    }
  }

  return summary;
}
