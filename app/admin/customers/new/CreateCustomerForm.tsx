"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Send, CheckCircle2, Mail } from "lucide-react";
import { createCustomerManually } from "./actions";

export function CreateCustomerForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    startTransition(async () => {
      const r = await createCustomerManually({
        email: email.trim(),
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        send_invite: sendInvite,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const parts: string[] = [];
      parts.push(r.existed ? "Customer already existed (info refreshed)" : "Customer created");
      if (r.invited) parts.push("invite email sent");
      else if (sendInvite) parts.push("but invite email failed");
      toast.success(parts.join(" · "));
      router.push(`/admin/customers/${encodeURIComponent(email.trim().toLowerCase())}`);
    });
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
          Email *
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@example.com"
          className="input"
          autoFocus
        />
        <p className="text-[10px] text-slate-500 mt-1">
          If this email already exists, we'll just refresh their info.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">First name</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Maria"
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Last name</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Lopez"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="555-1234"
          className="input"
        />
      </div>

      <label className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(e) => setSendInvite(e.target.checked)}
          className="mt-1"
        />
        <div>
          <div className="text-sm font-semibold text-indigo-900 flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" /> Send a magic link invite email
          </div>
          <div className="text-xs text-indigo-700 mt-0.5">
            The customer gets a "Welcome — sign in to your portal" email with a 1-hour secure link.
            Recommended for new accounts.
          </div>
        </div>
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-lg px-5 py-2 inline-flex items-center gap-1 shadow-sm"
        >
          {pending ? (
            <>
              <Save className="h-4 w-4 animate-pulse" /> Creating…
            </>
          ) : sendInvite ? (
            <>
              <Send className="h-4 w-4" /> Create + send invite
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Create customer
            </>
          )}
        </button>
      </div>
    </form>
  );
}
