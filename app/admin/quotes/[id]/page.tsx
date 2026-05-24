import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { QuoteEditor } from "../QuoteEditor";
import { QuoteActions } from "./QuoteActions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  approved: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  expired: "bg-amber-100 text-amber-800",
  converted: "bg-purple-100 text-purple-800",
};

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!quote) notFound();

  // Drafts: render editable form
  if (quote.status === "draft") {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, slug, price_per_day")
      .eq("is_active", true)
      .order("name", { ascending: true });

    const initial = {
      id: quote.id,
      customer_first_name: quote.customer_first_name,
      customer_last_name: quote.customer_last_name,
      customer_company: quote.customer_company || "",
      customer_email: quote.customer_email,
      customer_phone: quote.customer_phone,
      customer_address: quote.customer_address || "",
      event_date: quote.event_date,
      event_end_date: quote.event_end_date || "",
      start_time: quote.start_time || "",
      end_time: quote.end_time || "",
      line_items: quote.line_items || [],
      discount_cents: quote.discount_cents || 0,
      discount_note: quote.discount_note || "",
      tax_cents: quote.tax_cents || 0,
      customer_message: quote.customer_message || "",
      internal_notes: quote.internal_notes || "",
      expires_days: Math.max(
        1,
        Math.ceil(
          (new Date(quote.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        ),
      ),
    };

    return (
      <div className="space-y-6">
        <QuoteActions
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          token={quote.token}
          status={quote.status}
        />
        <QuoteEditor initial={initial} products={products || []} />
      </div>
    );
  }

  // Non-draft: read-only view
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
  const quoteUrl = `${baseUrl}/quotes/${quote.token}`;
  const items = quote.line_items || [];

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/quotes"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to quotes
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-brand-navy">{quote.quote_number}</h1>
            <span
              className={`text-xs rounded px-2 py-0.5 ${STATUS_STYLES[quote.status] || ""}`}
            >
              {quote.status}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Created {new Date(quote.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      <QuoteActions
        quoteId={quote.id}
        quoteNumber={quote.quote_number}
        token={quote.token}
        status={quote.status}
        convertedBookingId={quote.converted_booking_id}
      />

      {/* Customer */}
      <div className="card mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
          Customer
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="font-medium">
              {quote.customer_first_name} {quote.customer_last_name}
            </div>
            {quote.customer_company && (
              <div className="text-slate-600 italic">{quote.customer_company}</div>
            )}
            <div className="text-slate-500">{quote.customer_email}</div>
            <div className="text-slate-500">{quote.customer_phone}</div>
          </div>
          {quote.customer_address && (
            <div className="text-slate-700">{quote.customer_address}</div>
          )}
        </div>
      </div>

      {/* Event */}
      <div className="card mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
          Event
        </h2>
        <div className="text-sm">
          <div>
            <strong>{quote.event_date}</strong>
            {quote.event_end_date && quote.event_end_date !== quote.event_date && (
              <> → <strong>{quote.event_end_date}</strong></>
            )}
          </div>
          {(quote.start_time || quote.end_time) && (
            <div className="text-slate-500">
              {quote.start_time} – {quote.end_time}
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="card mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
          Line items
        </h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left py-2">Item</th>
              <th className="text-center py-2 w-20">Qty</th>
              <th className="text-right py-2 w-32">Unit</th>
              <th className="text-right py-2 w-28">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it: any, i: number) => (
              <tr key={i}>
                <td className="py-2">{it.name}</td>
                <td className="py-2 text-center font-mono">{it.quantity}</td>
                <td className="py-2 text-right font-mono">
                  {formatCurrency(it.unit_price_cents)}
                </td>
                <td className="py-2 text-right font-mono">
                  {formatCurrency(it.line_total_cents || it.unit_price_cents * it.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr>
              <td colSpan={3} className="text-right py-1 text-slate-600">
                Subtotal
              </td>
              <td className="text-right font-mono py-1">{formatCurrency(quote.subtotal_cents)}</td>
            </tr>
            {quote.discount_cents > 0 && (
              <tr>
                <td colSpan={3} className="text-right py-1 text-slate-600">
                  Discount {quote.discount_note && `(${quote.discount_note})`}
                </td>
                <td className="text-right font-mono py-1 text-amber-700">
                  -{formatCurrency(quote.discount_cents)}
                </td>
              </tr>
            )}
            {quote.tax_cents > 0 && (
              <tr>
                <td colSpan={3} className="text-right py-1 text-slate-600">
                  Tax
                </td>
                <td className="text-right font-mono py-1">{formatCurrency(quote.tax_cents)}</td>
              </tr>
            )}
            <tr className="border-t">
              <td colSpan={3} className="text-right pt-2 font-semibold">
                Total
              </td>
              <td className="text-right font-mono pt-2 font-bold text-brand-navy text-lg">
                {formatCurrency(quote.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Messages */}
      {quote.customer_message && (
        <div className="card mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2">
            Message to customer
          </h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {quote.customer_message}
          </p>
        </div>
      )}
      {quote.internal_notes && (
        <div className="card mt-4 bg-amber-50 border-amber-200">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700 mb-2">
            Internal notes
          </h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{quote.internal_notes}</p>
        </div>
      )}

      {/* Lifecycle */}
      <div className="card mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2">
          Lifecycle
        </h2>
        <ul className="text-xs space-y-1 text-slate-600">
          <li>Created: {new Date(quote.created_at).toLocaleString()}</li>
          {quote.sent_at && <li>Sent: {new Date(quote.sent_at).toLocaleString()}</li>}
          {quote.viewed_at && <li>Viewed by customer: {new Date(quote.viewed_at).toLocaleString()}</li>}
          {quote.approved_at && (
            <li className="text-green-700">
              Approved: {new Date(quote.approved_at).toLocaleString()}
            </li>
          )}
          {quote.declined_at && (
            <li className="text-red-700">
              Declined: {new Date(quote.declined_at).toLocaleString()}
              {quote.decline_reason && ` — ${quote.decline_reason}`}
            </li>
          )}
          <li>Expires: {new Date(quote.expires_at).toLocaleString()}</li>
        </ul>
      </div>

      {quote.converted_booking_id && (
        <div className="card mt-4 bg-green-50 border-green-200">
          <p className="text-sm">
            ✓ Converted to{" "}
            <Link
              href={`/admin/bookings/${quote.converted_booking_id}`}
              className="text-green-700 font-semibold hover:underline inline-flex items-center gap-1"
            >
              booking <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
