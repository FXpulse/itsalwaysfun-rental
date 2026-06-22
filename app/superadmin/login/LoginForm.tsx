"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Crown } from "lucide-react";

export function SuperadminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/superadmin/tenants";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (errorParam === "not_superadmin") {
      const supabase = createClient();
      supabase.auth.signOut().then(() => {
        toast.error("You don't have superadmin access to this platform.");
      });
    }
  }, [errorParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    router.push(next);
    router.refresh();
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
            <h1 className="text-2xl font-bold text-brand-navy">SaaS owner login</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage all RentalFlow tenants across the platform
            </p>
          </div>

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
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <p className="text-center text-xs text-slate-500">
              <Link
                href="/superadmin/forgot-password"
                className="text-brand-navy underline"
              >
                Forgot password?
              </Link>
            </p>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Only accounts with is_superadmin=true can sign in here.
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Looking for tenant login? Go to{" "}
          <span className="font-mono">your-slug.getrentalflow.com/admin/login</span>
        </p>
      </div>
    </div>
  );
}
