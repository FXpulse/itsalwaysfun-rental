"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Landing page hit by the recovery email link. Supabase puts the recovery
 *  token in the URL hash and the client SDK exchanges it for a session
 *  automatically. Once the session is established we let the user set a
 *  new password via auth.updateUser. */
export default function SuperadminResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // The Supabase client picks up the hash token automatically on page
    // load. We just wait for the auth event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(true);
      }
    });
    // Race fallback: check immediately in case the event already fired.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      else if (hasSession === null) {
        // Give the hash-token exchange a moment, then fall back to "no session"
        setTimeout(() => setHasSession((s) => (s === null ? false : s)), 1500);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 12) {
      toast.error("Use at least 12 characters for a superadmin password");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Sign in with your new password.");
    await supabase.auth.signOut();
    router.push("/superadmin/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="RentalFlow home" className="block text-center mb-6">
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
            <h1 className="text-2xl font-bold text-brand-navy">Set a new password</h1>
          </div>

          {hasSession === null && (
            <p className="text-sm text-slate-500 text-center">
              Verifying your reset link…
            </p>
          )}

          {hasSession === false && (
            <div className="text-sm bg-red-50 border border-red-200 rounded-lg p-4 text-red-900">
              <p className="font-semibold mb-1">This reset link is invalid or expired.</p>
              <p>
                Request a fresh one at{" "}
                <Link
                  href="/superadmin/forgot-password"
                  className="underline font-semibold"
                >
                  /superadmin/forgot-password
                </Link>
                .
              </p>
            </div>
          )}

          {hasSession === true && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New password
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Minimum 12 characters. Use a passphrase or a password manager.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm new password
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Updating..." : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
