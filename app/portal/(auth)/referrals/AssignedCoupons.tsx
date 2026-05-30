"use client";

// Renders coupons admin has assigned to this customer. Each is a shareable
// card with copy + native share + WhatsApp/SMS/Email buttons. Uses stats
// already computed server-side (uses, commission earned).

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Share2, MessageCircle, Mail, Ticket, TrendingUp } from "lucide-react";

interface AssignedCoupon {
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
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-violet-700 mb-1">
            Your coupon
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
