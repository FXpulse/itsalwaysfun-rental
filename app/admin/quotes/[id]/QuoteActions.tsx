"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Send, Copy, Check, X, Trash2, RefreshCw } from "lucide-react";
import { sendQuote, cancelQuote, deleteQuote, regeneratePaymentLink } from "../actions";

export function QuoteActions({
  quoteId,
  quoteNumber,
  token,
  status,
  convertedBookingId,
}: {
  quoteId: string;
  quoteNumber: string;
  token: string;
  status: string;
  convertedBookingId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://itsalwaysfun-rental.vercel.app";
  const quoteUrl = `${baseUrl}/quotes/${token}`;

  function handleSend() {
    if (!confirm(`Send ${quoteNumber}? This will mark it as sent and trigger the GHL workflow if configured.`))
      return;
    startTransition(async () => {
      const r = await sendQuote(quoteId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Quote marked as sent. Share the link with the customer.");
      router.refresh();
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(quoteUrl).then(() => {
      setCopied(true);
      toast.success("Link copied — paste it in WhatsApp/SMS/email");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCancel() {
    if (!confirm("Cancel this quote? It can't be sent or approved after this.")) return;
    startTransition(async () => {
      const r = await cancelQuote(quoteId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Quote cancelled");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Permanently delete this quote? This cannot be undone.")) return;
    startTransition(async () => {
      const r = await deleteQuote(quoteId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Quote deleted");
      router.push("/admin/quotes");
    });
  }

  function handleRegenerate() {
    if (!confirm(
      "Cancel the old payment link and create a new one?\n\n" +
      "Use this if the customer hits an error paying. The booking stays the same — only the Stripe payment session is reset, with a fresh 24h hold.",
    )) return;
    startTransition(async () => {
      const r = await regeneratePaymentLink(quoteId);
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success("New payment link generated — copy and send to customer");
      router.refresh();
    });
  }

  return (
    <div className="card flex flex-wrap gap-2 items-center">
      {status === "draft" && (
        <>
          <button
            onClick={handleSend}
            disabled={pending}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Send className="h-4 w-4" /> Send to customer
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-800 px-3 py-2"
          >
            <Trash2 className="h-4 w-4" /> Delete draft
          </button>
        </>
      )}

      {(status === "sent" || status === "viewed" || status === "approved") && (
        <>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 text-sm border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy customer link"}
          </button>
          <code className="text-xs text-slate-500 truncate max-w-md">{quoteUrl}</code>
          {status === "approved" && convertedBookingId && (
            <button
              onClick={handleRegenerate}
              disabled={pending}
              className="inline-flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-300 text-indigo-700 hover:bg-indigo-100 rounded-md px-3 py-2"
              title="Cancel old Stripe intent + create a fresh one. Use when customer hits an error paying."
            >
              <RefreshCw className="h-4 w-4" /> Regenerate payment link
            </button>
          )}
          {status !== "approved" && (
            <button
              onClick={handleCancel}
              disabled={pending}
              className="inline-flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 px-3 py-2 ml-auto"
            >
              <X className="h-4 w-4" /> Cancel quote
            </button>
          )}
        </>
      )}

      {(status === "declined" || status === "expired" || status === "converted") && (
        <p className="text-sm text-slate-500">
          {status === "converted"
            ? "Quote was approved and converted to a booking."
            : `Quote ${status}. Create a new one if needed.`}
        </p>
      )}
    </div>
  );
}
