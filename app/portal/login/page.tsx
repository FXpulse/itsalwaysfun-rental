"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function CustomerLoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/portal/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md card text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-brand-navy mb-2">Check your email</h1>
          <p className="text-sm text-slate-600 mb-4">
            We sent a sign-in link to <strong>{email}</strong>. Click the link to access
            your bookings.
          </p>
          <p className="text-xs text-slate-400">
            Link expires in 1 hour. Didn't get it?{" "}
            <button
              onClick={() => setSent(false)}
              className="text-brand-navy hover:underline"
            >
              Try again
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md card">
        <div className="text-center mb-6">
          <div className="inline-block bg-brand-yellow text-brand-navy text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-3">
            CUSTOMER PORTAL
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter your email — we'll send a sign-in link. No password needed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <Mail className="h-3 w-3 inline mr-1" /> Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full inline-flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send sign-in link"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          First time? Just enter your email — we'll create an account if you don't have one.
        </p>

        <div className="border-t mt-6 pt-4 text-center text-xs text-slate-400">
          New customer?{" "}
          <Link href="/order-by-date" className="text-brand-navy hover:underline">
            Book directly without an account
          </Link>
        </div>
      </div>
    </div>
  );
}
