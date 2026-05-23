import { createAdminClient } from "@/lib/supabase/admin";
import { Check, X, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // System checks
  const checks = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripe:
      !!process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_SECRET_KEY !== "" &&
      !process.env.STRIPE_SECRET_KEY.startsWith("PASTE"),
    stripeWebhook:
      !!process.env.STRIPE_WEBHOOK_SECRET &&
      !process.env.STRIPE_WEBHOOK_SECRET.startsWith("PASTE"),
    ghlApi:
      !!process.env.GHL_API_KEY &&
      process.env.GHL_API_KEY.startsWith("pit-"),
    ghlWebhook: !!process.env.GHL_WEBHOOK_SECRET,
  };

  // Active product count (sanity check)
  const supabase = createAdminClient();
  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-6">
        System status, integrations, and business info.
      </p>

      {/* Business info */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Business info</h2>
        <dl className="space-y-3 text-sm">
          <Row label="Business name" value={process.env.NEXT_PUBLIC_BUSINESS_NAME || "—"} />
          <Row label="Phone" value={process.env.NEXT_PUBLIC_BUSINESS_PHONE || "(not set)"} />
          <Row label="Address" value={process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "Jacksonville, FL"} />
          <Row label="Notification email" value={process.env.NOTIFICATION_EMAIL || "—"} />
          <Row label="App URL" value={process.env.NEXT_PUBLIC_APP_URL || "—"} />
        </dl>
        <p className="text-xs text-slate-400 mt-4">
          To change these, edit env vars in Vercel: Settings → Environment Variables.
        </p>
      </div>

      {/* Integrations */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Integrations</h2>
        <dl className="space-y-3">
          <Status
            label="Supabase database"
            ok={checks.supabaseUrl && checks.supabaseAnon && checks.supabaseService}
            detail={`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "") || "(missing)"}`}
          />
          <Status
            label="Stripe payments"
            ok={checks.stripe}
            detail={
              checks.stripe
                ? checks.stripeWebhook
                  ? "API key + webhook secret configured"
                  : "API key OK, webhook secret missing (configure /api/webhooks/stripe)"
                : "Not configured — Phase 2 pending"
            }
          />
          <Status
            label="GoHighLevel API"
            ok={checks.ghlApi}
            detail={
              checks.ghlApi
                ? `Sub-account: ${process.env.GHL_LOCATION_ID || "(missing location ID)"}`
                : "PIT not configured"
            }
          />
        </dl>
      </div>

      {/* Inventory snapshot */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Inventory</h2>
        <dl className="space-y-3 text-sm">
          <Row label="Active products" value={productCount?.toString() || "0"} />
        </dl>
        <p className="text-xs text-slate-400 mt-4">
          Manage products in the <a href="/admin/products" className="text-brand-navy underline">Products</a> page.
        </p>
      </div>

      {/* Reference links */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Reference links</h2>
        <ul className="space-y-2 text-sm">
          <Link href="https://supabase.com/dashboard" label="Supabase Dashboard" />
          <Link href="https://dashboard.stripe.com" label="Stripe Dashboard" />
          <Link href="https://vercel.com/dashboard" label="Vercel Deployments" />
          <Link
            href={`https://panel.sclickmedia.com/v2/location/${process.env.GHL_LOCATION_ID || ""}/dashboard`}
            label="GHL Sub-account (It's Always Fun)"
          />
          <Link href="https://github.com/FXpulse/itsalwaysfun-rental" label="GitHub Repo" />
        </ul>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-slate-100 pb-2">
      <dt className="text-slate-500 w-40 text-sm">{label}</dt>
      <dd className="text-slate-900 font-medium">{value}</dd>
    </div>
  );
}

function Status({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
      <div className="mt-0.5">
        {ok ? (
          <Check className="h-5 w-5 text-emerald-600" />
        ) : (
          <X className="h-5 w-5 text-amber-500" />
        )}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function Link({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-brand-navy hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {label}
      </a>
    </li>
  );
}
