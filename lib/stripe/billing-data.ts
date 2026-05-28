// Server-only Stripe data fetchers for the tenant Billing page.
// Each fn is best-effort and returns null/empty on error so the page
// always renders even if Stripe is briefly unreachable.

import { getStripe } from "./server";

export interface BillingPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_expired: boolean;
  expires_soon: boolean;
}

export interface BillingInvoice {
  id: string;
  number: string | null;
  status: string;
  amount_paid_cents: number;
  amount_due_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  hosted_url: string | null;
  pdf_url: string | null;
}

export interface UpcomingCharge {
  amount_cents: number;
  currency: string;
  next_payment_at: string | null;
}

/** Fetch the default payment method (card on file). */
export async function fetchPaymentMethod(
  customerId: string,
): Promise<BillingPaymentMethod | null> {
  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if ((customer as any).deleted) return null;
    const pm: any = (customer as any).invoice_settings?.default_payment_method;
    if (!pm || !pm.card) return null;
    const now = new Date();
    const expDate = new Date(pm.card.exp_year, pm.card.exp_month - 1, 1);
    const sixMonths = new Date();
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    return {
      id: pm.id,
      brand: String(pm.card.brand || "card"),
      last4: String(pm.card.last4 || ""),
      exp_month: Number(pm.card.exp_month),
      exp_year: Number(pm.card.exp_year),
      is_expired: expDate < now,
      expires_soon: expDate < sixMonths,
    };
  } catch (e) {
    console.error("[fetchPaymentMethod]", e);
    return null;
  }
}

/** Fetch the most recent invoices for the customer. */
export async function fetchInvoices(
  customerId: string,
  limit = 12,
): Promise<BillingInvoice[]> {
  try {
    const stripe = getStripe();
    const list = await stripe.invoices.list({ customer: customerId, limit });
    return list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: String(inv.status || "open"),
      amount_paid_cents: Number(inv.amount_paid) || 0,
      amount_due_cents: Number(inv.amount_due) || 0,
      currency: inv.currency,
      created_at: new Date((inv.created || 0) * 1000).toISOString(),
      paid_at: inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
        : null,
      period_start: inv.period_start
        ? new Date(inv.period_start * 1000).toISOString()
        : null,
      period_end: inv.period_end
        ? new Date(inv.period_end * 1000).toISOString()
        : null,
      hosted_url: inv.hosted_invoice_url || null,
      pdf_url: inv.invoice_pdf || null,
    }));
  } catch (e) {
    console.error("[fetchInvoices]", e);
    return [];
  }
}

/** Fetch the upcoming invoice (next charge preview). */
export async function fetchUpcomingCharge(
  customerId: string,
): Promise<UpcomingCharge | null> {
  try {
    const stripe = getStripe();
    const upcoming = await (stripe.invoices as any).retrieveUpcoming({
      customer: customerId,
    });
    return {
      amount_cents: Number(upcoming.amount_due) || 0,
      currency: upcoming.currency,
      next_payment_at: upcoming.next_payment_attempt
        ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
        : upcoming.period_end
          ? new Date(upcoming.period_end * 1000).toISOString()
          : null,
    };
  } catch (e) {
    // No upcoming invoice when subscription is canceled / no sub — that's fine
    return null;
  }
}

/** Sum of amount_paid for invoices paid in the current calendar year.
 *  Useful for tenants who deduct RentalFlow as a business expense. */
export function sumPaidThisYear(invoices: BillingInvoice[]): number {
  const currentYear = new Date().getFullYear();
  return invoices
    .filter(
      (i) =>
        i.status === "paid" &&
        i.paid_at &&
        new Date(i.paid_at).getFullYear() === currentYear,
    )
    .reduce((s, i) => s + i.amount_paid_cents, 0);
}
