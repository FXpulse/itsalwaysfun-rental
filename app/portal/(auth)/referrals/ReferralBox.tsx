"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Share2, MessageCircle, Mail } from "lucide-react";

export function ReferralBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://itsalwaysfun-rental.vercel.app";
  const link = `${baseUrl}/?ref=${code}`;

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success("Link copied! Now share it with friends.");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const message = `Hey! I rented from It's Always Fun (bounce houses in Jacksonville). They're great — book with my link and we both get rewards: ${link}`;

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(message)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent("You'll love It's Always Fun rentals")}&body=${encodeURIComponent(message)}`;

  function nativeShare() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any)
        .share({ title: "It's Always Fun", text: message, url: link })
        .catch(() => {});
    } else {
      copyLink();
    }
  }

  return (
    <div className="card border-2 border-brand-yellow bg-gradient-to-br from-white to-brand-yellow/10">
      <div className="text-xs font-bold uppercase tracking-widest text-brand-navy mb-2">
        Your referral link
      </div>

      <div className="flex flex-col gap-2">
        <div className="bg-white border border-slate-300 rounded px-3 py-2 font-mono text-sm break-all">
          {link}
        </div>
        <div className="text-xs text-slate-500">
          Your unique code: <strong className="text-brand-navy">{code}</strong>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={copyLink}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          onClick={nativeShare}
          className="inline-flex items-center gap-2 text-sm border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm border border-green-500 text-green-700 rounded-md px-3 py-2 hover:bg-green-50"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a
          href={smsHref}
          className="inline-flex items-center gap-2 text-sm border border-blue-500 text-blue-700 rounded-md px-3 py-2 hover:bg-blue-50"
        >
          <MessageCircle className="h-4 w-4" /> SMS
        </a>
        <a
          href={emailHref}
          className="inline-flex items-center gap-2 text-sm border border-slate-400 text-slate-700 rounded-md px-3 py-2 hover:bg-slate-50"
        >
          <Mail className="h-4 w-4" /> Email
        </a>
      </div>
    </div>
  );
}
