"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Gift, X, Copy, Check } from "lucide-react";
import { issueGiftCard, toggleGiftCardActive } from "./actions";
import { formatCurrency } from "@/lib/utils";

interface GiftCardRow {
  id: string;
  code: string;
  original_amount_cents: number;
  balance_cents: number;
  recipient_email: string;
  recipient_name: string | null;
  purchaser_name: string | null;
  message: string | null;
  expires_at: string | null;
  sent_to_recipient_at: string | null;
  fully_redeemed_at: string | null;
  is_active: boolean;
  created_at: string;
}

export function GiftCardsManager({ cards }: { cards: GiftCardRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issuing, setIssuing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  function handleIssue(formData: FormData) {
    startTransition(async () => {
      const r = await issueGiftCard(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Gift card issued: ${r.code}`);
      setIssuing(false);
      router.refresh();
    });
  }

  function handleToggle(c: GiftCardRow) {
    const action = c.is_active ? "disable" : "re-enable";
    if (
      c.is_active &&
      !confirm(`Disable ${c.code}? Customers won't be able to redeem it (you can re-enable later).`)
    )
      return;
    startTransition(async () => {
      const r = await toggleGiftCardActive(c.id, c.is_active);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(c.is_active ? "Disabled" : "Re-enabled — customers can redeem again");
      router.refresh();
    });
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast.success("Code copied");
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIssuing(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Issue gift card
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No gift cards issued yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Recipient</th>
                <th className="px-4 py-3 text-right">Original</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Issued</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cards.map((c) => {
                const expired = c.expires_at && new Date(c.expires_at) < new Date();
                const fullyRedeemed = c.balance_cents === 0;
                return (
                  <tr key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyCode(c.code)}
                        className="font-mono text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded inline-flex items-center gap-1"
                      >
                        {c.code}
                        {copiedCode === c.code ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{c.recipient_name || c.recipient_email}</div>
                      <div className="text-[10px] text-slate-500">{c.recipient_email}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(c.original_amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-brand-navy">
                      {formatCurrency(c.balance_cents)}
                    </td>
                    <td className="px-4 py-3">
                      {!c.is_active ? (
                        <span className="text-xs bg-slate-200 text-slate-600 rounded px-2 py-0.5">
                          Disabled
                        </span>
                      ) : fullyRedeemed ? (
                        <span className="text-xs bg-slate-200 text-slate-600 rounded px-2 py-0.5">
                          Fully redeemed
                        </span>
                      ) : expired ? (
                        <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-0.5">
                          Expired
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggle(c)}
                        disabled={pending}
                        title={c.is_active ? "Click to disable (can re-enable later)" : "Click to re-enable"}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                          c.is_active ? "bg-green-600" : "bg-slate-300"
                        } ${pending ? "opacity-50" : ""}`}
                        role="switch"
                        aria-checked={c.is_active}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                            c.is_active ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {issuing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setIssuing(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-brand-navy">Issue gift card</h2>
              <button onClick={() => setIssuing(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form action={handleIssue} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Amount (USD) *</label>
                  <input
                    name="amount_dollars"
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    className="input"
                    defaultValue="50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Expires in days <span className="text-slate-400">(0 = never)</span>
                  </label>
                  <input
                    name="expires_days"
                    type="number"
                    min={0}
                    className="input"
                    placeholder="365"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Recipient email *</label>
                <input
                  name="recipient_email"
                  type="email"
                  required
                  className="input"
                  placeholder="friend@example.com"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Recipient name</label>
                  <input name="recipient_name" className="input" placeholder="Maria" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">From (purchaser)</label>
                  <input
                    name="purchaser_name"
                    className="input"
                    placeholder="John or your business"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Personal message (optional)
                </label>
                <textarea
                  name="message"
                  rows={2}
                  className="input"
                  placeholder="Happy birthday! Enjoy your bounce house :)"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={pending} className="btn-primary flex-1">
                  {pending ? "Issuing..." : "Issue card + email recipient"}
                </button>
                <button
                  type="button"
                  onClick={() => setIssuing(false)}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
