"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Mail, ArrowRight, KeyRound } from "lucide-react";
import Link from "next/link";
import { postLoginHookup } from "./actions";

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md card text-center text-slate-400">Loading…</div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        // No emailRedirectTo — we use the OTP code, not the link
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setStep("code");
    toast.success("Code sent — check your email");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const cleanCode = code.replace(/\s+/g, "").trim();

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: cleanCode,
      type: "email",
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Post-login hookup (profile + referrer) — best effort, don't block
    try {
      await postLoginHookup();
    } catch {}

    toast.success("Signed in");
    // Use full reload to ensure session cookie picks up server-side
    window.location.href = next;
  }

  if (step === "code") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md card">
          <div className="text-center mb-6">
            <KeyRound className="h-12 w-12 text-brand-navy mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-brand-navy">Enter your code</h1>
            <p className="text-sm text-slate-500 mt-1">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoComplete="one-time-code"
                className="input text-center text-2xl tracking-[0.5em] font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                Look for the code in the email subject line or body. Expires in 1 hour.
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verifying..." : "Verify code"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="border-t mt-6 pt-4 text-center text-xs">
            <button
              onClick={() => {
                setStep("email");
                setCode("");
              }}
              className="text-slate-500 hover:text-brand-navy"
            >
              ← Use a different email
            </button>
          </div>
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
            Enter your email — we'll send a 6-digit code. No password needed.
          </p>
        </div>

        <form onSubmit={handleSendCode} className="space-y-4">
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
            {loading ? "Sending..." : "Send 6-digit code"}
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
