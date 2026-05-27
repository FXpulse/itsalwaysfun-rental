"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { resetAdminPassword } from "./actions";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = await resetAdminPassword(formData);
      if (!r.ok) {
        toast.error(r.error || "Reset failed");
        return;
      }
      toast.success("Password reset! Sign in with the new password.");
      setDone(true);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md card">
        <div className="text-center mb-6">
          <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-3">
            TEMPORARY RESET
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">Reset admin password</h1>
          <p className="text-sm text-slate-500 mt-2">
            One-shot tool — gated by your CRON_SECRET. Only works for emails
            that already have an active admin/staff/driver role.
          </p>
        </div>

        {done ? (
          <div className="text-center space-y-3">
            <div className="text-emerald-700 text-3xl">✓</div>
            <p className="text-sm text-slate-700">
              Password updated successfully.
            </p>
            <button
              onClick={() => router.push("/admin/login")}
              className="btn-primary w-full"
            >
              Go to login
            </button>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                defaultValue="admin@itsalwaysfun.com"
                className="input"
                disabled={pending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New password (min 6 chars)
              </label>
              <input
                name="password"
                type="text"
                required
                minLength={6}
                placeholder="e.g. NewPassword2026!"
                className="input font-mono"
                disabled={pending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reset token
              </label>
              <input
                name="secret"
                type="text"
                required
                placeholder="iaf-reset-..."
                className="input font-mono"
                disabled={pending}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                One-time token provided by your dev. This page + token will be
                removed right after you use it.
              </p>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}

        <p className="text-center text-[10px] text-slate-400 mt-6">
          This page will be removed after the reset.
        </p>
      </div>
    </div>
  );
}
