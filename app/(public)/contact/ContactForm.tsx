"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, CheckCircle } from "lucide-react";

export function ContactForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: String(formData.get("firstName") || ""),
      lastName: String(formData.get("lastName") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      message: String(formData.get("message") || ""),
      source: "website-contact",
    };

    startTransition(async () => {
      try {
        const r = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) {
          toast.error(data.error || "Failed to send message");
          return;
        }
        setSent(true);
        toast.success("Message sent!");
      } catch (e: any) {
        toast.error(e.message || "Network error");
      }
    });
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-brand-navy mb-2">Message sent!</h3>
        <p className="text-slate-600 mb-4">
          We&apos;ll reply to you within 4 hours during business hours.
        </p>
        <button
          onClick={() => setSent(false)}
          className="text-brand-navy hover:underline text-sm"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">First name *</label>
          <input name="firstName" required className="input" disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Last name *</label>
          <input name="lastName" required className="input" disabled={pending} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
          <input name="email" type="email" required className="input" disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input name="phone" type="tel" placeholder="(904) 555-1234" className="input" disabled={pending} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Message *</label>
        <textarea
          name="message"
          required
          rows={5}
          placeholder="How can we help?"
          className="input"
          disabled={pending}
        />
      </div>

      <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
        <Send className="h-4 w-4" />
        {pending ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
