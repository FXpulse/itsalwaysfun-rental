"use client";

// Renders coupons admin has assigned to this customer. Each is a shareable
// card with copy + native share + WhatsApp/SMS/Email buttons. Uses stats
// already computed server-side (uses, commission earned).

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check, Share2, MessageCircle, Mail, Ticket, TrendingUp, Pencil, X, AlertTriangle } from "lucide-react";
import { renameOwnReferralCoupon } from "./actions";

interface AssignedCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed" | "overnight_free";
  discount_value: number;
  current_uses: number;
  commission_earned_cents: number;
}

function discountLabel(c: AssignedCoupon): string {
  if (c.discount_type === "percent") return `${c.discount_value}% off`;
  if (c.discount_type === "fixed") return `$${(c.discount_value / 100).toFixed(0)} off`;
  return "Overnight free";
}

export function AssignedCoupons({
  coupons, businessName,
}: {
  coupons: AssignedCoupon[];
  businessName: string;
}) {
  if (coupons.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
        <Ticket className="h-3.5 w-3.5" /> Your personal coupons
      </h2>
      {coupons.map((c) => (
        <CouponCard key={c.code} coupon={c} businessName={businessName} />
      ))}
    </div>
  );
}

function CouponCard({ coupon, businessName }: { coupon: AssignedCoupon; businessName: string }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${baseUrl}/order-by-date?coupon=${coupon.code}`;
  const discount = discountLabel(coupon);

  function copyCode() {
    navigator.clipboard.writeText(coupon.code).then(() => {
      setCopied(true);
      toast.success(`Code "${coupon.code}" copied`);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const message = `Hey! Use my code ${coupon.code} for ${discount} on your rental at ${businessName}: ${link}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(message)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(`${discount} at ${businessName} — use my code`)}&body=${encodeURIComponent(message)}`;

  function nativeShare() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any).share({ title: businessName, text: message, url: link }).catch(() => {});
    } else {
      copyCode();
    }
  }

  return (
    <div className="card border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50">
      {editing && (
        <RenameDialog
          couponId={coupon.id}
          currentCode={coupon.code}
          onClose={() => setEditing(false)}
        />
      )}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="text-xs font-bold uppercase tracking-widest text-violet-700">
              Your coupon
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] inline-flex items-center gap-0.5 text-violet-700 hover:text-violet-900 underline"
              title="Personalize this code"
            >
              <Pencil className="h-2.5 w-2.5" /> Rename
            </button>
          </div>
          <div className="text-3xl font-mono font-bold text-violet-900">{coupon.code}</div>
          <div className="text-sm text-slate-700 mt-1">
            {discount}
            {coupon.description && <span className="text-slate-500"> · {coupon.description}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Earned</div>
          <div className="text-xl font-bold text-emerald-700 inline-flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            ${(coupon.commission_earned_cents / 100).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">{coupon.current_uses} {coupon.current_uses === 1 ? "use" : "uses"}</div>
        </div>
      </div>

      <div className="bg-white border border-violet-200 rounded p-2 font-mono text-xs break-all text-slate-700 mb-3">
        {link}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={copyCode}
          className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-md px-3 py-2 text-sm inline-flex items-center gap-1"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy code"}
        </button>
        <button
          onClick={nativeShare}
          className="inline-flex items-center gap-1 text-sm border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm border border-green-500 text-green-700 rounded-md px-3 py-2 hover:bg-green-50"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a
          href={smsHref}
          className="inline-flex items-center gap-1 text-sm border border-blue-500 text-blue-700 rounded-md px-3 py-2 hover:bg-blue-50"
        >
          <MessageCircle className="h-4 w-4" /> SMS
        </a>
        <a
          href={emailHref}
          className="inline-flex items-center gap-1 text-sm border border-slate-400 text-slate-700 rounded-md px-3 py-2 hover:bg-slate-50"
        >
          <Mail className="h-4 w-4" /> Email
        </a>
      </div>

      <p className="text-[10px] text-slate-500 mt-3">
        💡 Whoever uses this code at checkout earns you commission on their first booking — no cookie needed.
      </p>
    </div>
  );
}

function RenameDialog({
  couponId,
  currentCode,
  onClose,
}: {
  couponId: string;
  currentCode: string;
  onClose: () => void;
}) {
  const [newCode, setNewCode] = useState(currentCode);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const trimmed = newCode.trim().toUpperCase();
    if (trimmed === currentCode) {
      onClose();
      return;
    }
    if (!/^[A-Z0-9-]{3,20}$/.test(trimmed)) {
      toast.error("3–20 chars, letters, numbers, dashes only");
      return;
    }
    startTransition(async () => {
      const r = await renameOwnReferralCoupon({ couponId, newCode: trimmed });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Code renamed to "${r.newCode}"`);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg max-w-md w-full p-5 shadow-xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900">Personalize your code</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          You can rename your share code. The discount stays the same — you can't
          change the value, only the name.
        </p>

        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
          New code
        </label>
        <input
          type="text"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
          maxLength={20}
          autoFocus
          className="w-full border-2 border-slate-200 rounded px-3 py-2 font-mono text-lg focus:border-violet-500 outline-none"
          placeholder="MARIA-FAVS"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          3–20 characters · letters, numbers, dashes only
        </p>

        <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Heads up:</strong> anyone with your OLD code link will get
            an error at checkout. Tell your friends to use the new one.
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="text-sm text-slate-600 px-3 py-2 hover:bg-slate-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded text-sm"
          >
            {pending ? "Saving..." : "Save new code"}
          </button>
        </div>
      </div>
    </div>
  );
}
