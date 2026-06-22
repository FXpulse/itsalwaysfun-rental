"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Crown } from "lucide-react";
import { requestSuperadminReset } from "./actions";

export default function SuperadminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await requestSuperadminReset(email);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error || "Request failed");
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          aria-label="RentalFlow home"
          className="block text-center mb-6"
        >
          <img
            src="/01_rentalflow_lockup_light.svg"
            alt="RentalFlow"
            className="h-12 w-auto mx-auto"
          />
        </Link>

        <div className="card">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-3">
              <Crown className="h-3 w-3" /> SUPERADMIN
            </div>
            <h1 className="text-2xl font-bold text-brand-navy">Reset your password</h1>
            <p className="text-sm text-slate-500 mt-1">
              We'll email you a one-time link to set a new password.
            </p>
          </div>

          {sent ? (
            <div className="text-sm text-slate-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="font-semibold text-emerald-900 mb-1">Check your inbox.</p>
              <p>
                If <span className="font-mono">{email}</span> belongs to a
                superadmin account, you'll receive a reset link in the next
                minute or two. The link is single-use and expires in about an
                hour.
              </p>
              <p className="mt-3">
                <Link
                  href="/superadmin/login"
                  className="text-brand-navy underline font-semibold"
                >
                  Back to sign-in
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </button>

              <p className="text-center text-xs text-slate-500">
                <Link href="/superadmin/login" className="text-brand-navy underline">
                  Back to sign-in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
