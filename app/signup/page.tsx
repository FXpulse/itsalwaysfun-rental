"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowRight, Check, AlertCircle } from "lucide-react";
import { signupTenant, checkSlugAvailable } from "./actions";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function SignupPage() {
  const [pending, startTransition] = useTransition();
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // Auto-fill slug from business name unless user edited it
  function handleBusinessName(v: string) {
    setBusinessName(v);
    if (!slugTouched) {
      setSlug(slugify(v));
    }
  }

  async function handleSlugCheck(v: string) {
    setSlug(v);
    setSlugTouched(true);
    if (v.length < 2) {
      setSlugAvailable(null);
      return;
    }
    const r = await checkSlugAvailable(v);
    setSlugAvailable(r.available);
  }

  function handleSubmit(formData: FormData) {
    formData.set("desired_slug", slug);
    startTransition(async () => {
      const r = await signupTenant(formData);
      if (!r.ok) {
        toast.error(r.error || "Signup failed");
        return;
      }
      toast.success(`Account created! Redirecting to ${r.tenant_slug}.getrentalflow.com...`);
      if (r.redirect_url) {
        setTimeout(() => {
          window.location.href = r.redirect_url!;
        }, 1200);
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-bold text-brand-navy">
            RentalFlow
          </Link>
          <p className="text-sm text-slate-500 mt-1">
            Start your 14-day free trial
          </p>
        </div>

        <div className="card">
          <form action={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business name *
              </label>
              <input
                name="business_name"
                type="text"
                required
                minLength={2}
                maxLength={200}
                value={businessName}
                onChange={(e) => handleBusinessName(e.target.value)}
                className="input"
                placeholder="Bounce Dreams Party Rentals"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Your subdomain *
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                  value={slug}
                  onChange={(e) => handleSlugCheck(e.target.value.toLowerCase())}
                  className="input font-mono text-sm flex-1"
                  placeholder="bouncedreams"
                />
                <span className="text-sm text-slate-500 whitespace-nowrap">
                  .getrentalflow.com
                </span>
              </div>
              <div className="mt-1 text-xs flex items-center gap-1 min-h-[16px]">
                {slugAvailable === true && (
                  <span className="text-emerald-700 inline-flex items-center gap-1">
                    <Check className="h-3 w-3" /> Available
                  </span>
                )}
                {slugAvailable === false && slug.length >= 2 && (
                  <span className="text-red-700 inline-flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Not available
                  </span>
                )}
                {slugAvailable === null && (
                  <span className="text-slate-400">
                    Letters, numbers, hyphens (lowercase). You can change this later.
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Your email *
              </label>
              <input
                name="owner_email"
                type="email"
                required
                className="input"
                placeholder="you@yourcompany.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone (optional)
              </label>
              <input
                name="owner_phone"
                type="tel"
                className="input"
                placeholder="+1 (555) 555-1234"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password *
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={100}
                className="input"
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={pending || slugAvailable === false}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {pending ? "Creating account..." : "Start free trial"}
              {!pending && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              By creating an account you agree to our terms of service.
              No credit card required during trial.
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Already have an account?{" "}
          <a href="https://getrentalflow.com" className="text-brand-navy underline">
            Sign in at your subdomain
          </a>
        </p>
      </div>
    </div>
  );
}
