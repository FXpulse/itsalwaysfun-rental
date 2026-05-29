"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { loginAction } from "./actions";

export function LoginForm({ businessName }: { businessName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (errorParam === "no_role") {
      const supabase = createClient();
      supabase.auth.signOut().then(() => {
        toast.error("Your account has no role assigned. Contact an admin.");
      });
    }
  }, [errorParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await loginAction(email, password);
    setLoading(false);

    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Welcome back!");
    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md card">
        <div className="text-center mb-6">
          <div className="inline-block bg-brand-yellow text-brand-navy text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-3">
            ADMIN
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">{businessName}</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage rentals</p>
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
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Forgot password? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
