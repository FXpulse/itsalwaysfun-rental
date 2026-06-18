// Send lifecycle emails when a booking changes state by admin/customer action.
// All idempotent via booking_emails_sent unique constraint.

// Local row shapes for the two SELECT queries below. Previously read via
// `(booking as any).…` because Supabase's untyped `.select(string)` returns
// `any`-ish — defining these here lets the call sites access fields with
// real type safety.
interface RefundedRow {
  customer_first_name: string;
  customer_email: string;
  product_name: string;
  event_date: string;
  tenant_id: string | null;
}

interface CancelledRow {
  customer_first_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_phone_sms_consent_at: string | null;
  product_name: string;
  event_date: string;
  stripe_payment_status: string;
  tenant_id: string | null;
}

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplated } from "@/lib/email/send-template";
import { isEmailConfigured } from "@/lib/email/send";
import { formatDateUS } from "@/lib/email/format-date";
import { getTenantEmailConfig } from "@/lib/email/tenant-email";
import { isSmsConfigured } from "@/lib/sms/send";
import { sendTenantSms } from "@/lib/sms/tenant-config";
import { renderTemplateSms } from "@/lib/email/render-template";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";

async function alreadySent(bookingId: string, emailType: string): Promise<boolean> {
  const supabase = createAdminClient();
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
  emailType: string,
  success: boolean,
  resendId?: string,
  errorMessage?: string,
) {
  const supabase = createAdminClient();
  await supabase.from("booking_emails_sent").insert({
    booking_id: bookingId,
    email_type: emailType,
    success,
    resend_id: resendId || null,
    error_message: errorMessage || null,
  });
}

/** Send refund-issued email. Called from refundBooking() action. */
export async function sendBookingRefunded(
  bookingId: string,
  refundCents: number,
  refundMethod: string, // 'stripe', 'cash', 'venmo', 'zelle', 'check', 'other'
): Promise<void> {
  if (!isEmailConfigured()) return;
  if (await alreadySent(bookingId, "booking_refunded")) return;

  const supabase = createAdminClient();
  const { data: bookingRaw } = await supabase
    .from("bookings")
    .select(
      "customer_first_name, customer_email, product_name, event_date, tenant_id",
    )
    .eq("id", bookingId)
    .single();
  if (!bookingRaw) return;
  const booking = bookingRaw as RefundedRow;

  const methodLabel =
    refundMethod === "stripe"
      ? "Credit card (via Stripe)"
      : refundMethod.charAt(0).toUpperCase() + refundMethod.slice(1);

  const tenantEmail = await getTenantEmailConfig(booking.tenant_id);
  if (!tenantEmail) {
    Sentry.captureMessage("Tenant email skipped — no custom domain configured", {
      level: "warning",
      tags: { tenant_id: booking.tenant_id || "", area: "tenant-email" },
    });
    return;
  }
  const r = await sendTemplated({
    key: "booking_refunded",
    to: booking.customer_email,
    from: tenantEmail.from,
    replyTo: tenantEmail.replyTo,
    vars: {
      firstName: booking.customer_first_name,
      productName: booking.product_name,
      eventDate: formatDateUS(booking.event_date),
      refundAmount: (refundCents / 100).toFixed(2),
      refundMethod: methodLabel,
    },
    tags: [
      { name: "type", value: "booking_refunded" },
      { name: "booking_id", value: bookingId },
    ],
  });

  await recordSend(bookingId, "booking_refunded", r.ok, r.id, r.ok ? undefined : r.error);
}

/** Send cancellation email. Called from updateBookingStatus when status='cancelled'
 *  or from customer-initiated cancel action.
 *  `cancellationReason` is optional; `hadPayment` tells the email whether to
 *  mention an incoming refund. */
export async function sendBookingCancelled(
  bookingId: string,
  cancellationReason?: string | null,
): Promise<void> {
  if (!isEmailConfigured()) return;
  if (await alreadySent(bookingId, "booking_cancelled")) return;

  const supabase = createAdminClient();
  const { data: bookingRaw } = await supabase
    .from("bookings")
    .select(
      "customer_first_name, customer_email, customer_phone, customer_phone_sms_consent_at, product_name, event_date, stripe_payment_status, tenant_id",
    )
    .eq("id", bookingId)
    .single();
  if (!bookingRaw) return;
  const booking = bookingRaw as CancelledRow;

  const hadPayment = booking.stripe_payment_status === "paid";

  const tenantEmail = await getTenantEmailConfig(booking.tenant_id);
  if (!tenantEmail) {
    Sentry.captureMessage("Tenant email skipped — no custom domain configured", {
      level: "warning",
      tags: { tenant_id: booking.tenant_id || "", area: "tenant-email" },
    });
    return;
  }
  const vars = {
    firstName: booking.customer_first_name,
    productName: booking.product_name,
    eventDate: formatDateUS(booking.event_date),
    cancellationReason: cancellationReason || "",
    hadPayment: hadPayment ? "true" : "",
    bookAgainUrl: `${BASE_URL}/order-by-date`,
  };
  const r = await sendTemplated({
    key: "booking_cancelled",
    to: booking.customer_email,
    from: tenantEmail.from,
    replyTo: tenantEmail.replyTo,
    vars,
    tags: [
      { name: "type", value: "booking_cancelled" },
      { name: "booking_id", value: bookingId },
    ],
  });

  await recordSend(bookingId, "booking_cancelled", r.ok, r.id, r.ok ? undefined : r.error);

  // SMS notify — gated by SMS opt-in. Even though cancellation is high-urgency,
  // the consent text at checkout binds us to only send what they opted into.
  // Customer still gets the email, which is the canonical channel anyway.
  if (
    isSmsConfigured() &&
    booking.customer_phone &&
    booking.customer_phone_sms_consent_at
  ) {
    const smsBody = await renderTemplateSms(
      "booking_cancelled",
      vars,
      booking.tenant_id,
    );
    if (smsBody) {
      await sendTenantSms({
        tenantId: booking.tenant_id,
        to: booking.customer_phone,
        body: smsBody,
      }).catch(() => {});
    }
  }
}
