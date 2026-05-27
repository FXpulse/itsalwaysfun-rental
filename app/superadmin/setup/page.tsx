import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Crown, CheckCircle2, AlertTriangle, ExternalLink, Copy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperadminSetupPage() {
  const authClient = createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) redirect("/superadmin/login?error=not_superadmin");

  const stripePriceConfigured = !!process.env.STRIPE_PRICE_PRO;
  const stripeKeyConfigured = !!process.env.STRIPE_SECRET_KEY;
  const stripeWebhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const emailConfigured = !!process.env.RESEND_API_KEY;
  const ghlConfigured = !!process.env.GHL_API_KEY;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-1">
        <img src="/01_rentalflow_lockup_light.svg" alt="RentalFlow" className="h-8 w-auto" />
        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full">
          <Crown className="h-3 w-3" /> SUPERADMIN
        </span>
      </div>
      <h1 className="text-2xl font-bold text-brand-navy mt-3">Platform setup checklist</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        Everything RentalFlow needs to fully onboard paying tenants.
      </p>

      <SetupCard
        n={1}
        title="Stripe — RentalFlow Pro subscription product"
        done={stripePriceConfigured}
        criticalIfMissing
      >
        <p className="text-sm text-slate-700 mb-3">
          You need a Stripe Product + Price representing the $99/mo Pro plan
          that tenants subscribe to. Without this, the "Start subscription"
          button in <code>/admin/settings/billing</code> errors out.
        </p>
        <ol className="list-decimal list-inside text-sm space-y-1 text-slate-700 mb-3">
          <li>
            Go to{" "}
            <a
              href="https://dashboard.stripe.com/products/create"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-navy hover:underline inline-flex items-center gap-1"
            >
              Stripe Dashboard → Products → New <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>
            Name: <code>RentalFlow Pro</code>
          </li>
          <li>
            Pricing: <strong>$99.00 / Recurring / Monthly</strong>
          </li>
          <li>Create product</li>
          <li>
            On the product page, copy the <strong>Price ID</strong> (looks like{" "}
            <code>price_1A2bCdEfGhIjKlMnOpQrStUv</code>)
          </li>
          <li>
            In Vercel → Project → Settings → Environment Variables, add:
            <pre className="bg-slate-50 border rounded p-2 mt-1 text-xs font-mono select-all">
              STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
            </pre>
          </li>
          <li>Redeploy to pick up the new env var</li>
        </ol>
        {stripePriceConfigured ? (
          <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded">
            ✓ Currently set: <code>{process.env.STRIPE_PRICE_PRO?.slice(0, 30)}...</code>
          </p>
        ) : (
          <p className="text-xs text-red-700 bg-red-50 p-2 rounded">
            ✕ <code>STRIPE_PRICE_PRO</code> is not set. Tenants can't subscribe.
          </p>
        )}
      </SetupCard>

      <SetupCard
        n={2}
        title="Stripe — Secret key + Webhook"
        done={stripeKeyConfigured && stripeWebhookConfigured}
        criticalIfMissing
      >
        <p className="text-sm text-slate-700 mb-2">
          <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code>{" "}
          need to be set in Vercel env vars. The webhook secret comes from
          Dashboard → Developers → Webhooks → your endpoint signing secret.
        </p>
        <p className="text-xs text-slate-500">
          Endpoint URL to register in Stripe:{" "}
          <code>https://www.getrentalflow.com/api/webhooks/stripe</code>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Events to subscribe: <code>checkout.session.completed</code>,{" "}
          <code>customer.subscription.updated</code>,{" "}
          <code>customer.subscription.deleted</code>,{" "}
          <code>invoice.payment_failed</code>,{" "}
          <code>payment_intent.succeeded</code>.
        </p>
      </SetupCard>

      <SetupCard n={3} title="Supabase database" done={supabaseConfigured} criticalIfMissing>
        <p className="text-sm text-slate-700">
          <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> all need to be in Vercel env.
        </p>
      </SetupCard>

      <SetupCard n={4} title="Email delivery (Resend)" done={emailConfigured} criticalIfMissing>
        <p className="text-sm text-slate-700">
          <code>RESEND_API_KEY</code> in Vercel env. Without it, no transactional
          emails go out — booking confirmations, gift card receipts, etc.
        </p>
      </SetupCard>

      <SetupCard n={5} title="GHL integration (optional)" done={ghlConfigured}>
        <p className="text-sm text-slate-700">
          <code>GHL_API_KEY</code> + <code>GHL_LOCATION_ID</code> if you want
          to sync new tenants and bookings to GoHighLevel. Skip for now and
          configure later — the app works without it.
        </p>
      </SetupCard>

      <div className="card bg-slate-50 mt-6">
        <h3 className="font-semibold mb-2">After every env var change</h3>
        <ol className="list-decimal list-inside text-sm space-y-1 text-slate-700">
          <li>Save in Vercel → Settings → Environment Variables</li>
          <li>Redeploy (or trigger a deploy with an empty commit)</li>
          <li>
            Verify on the{" "}
            <Link href="/admin/diagnostics" className="text-brand-navy underline">
              /admin/diagnostics
            </Link>{" "}
            page — every check should be green
          </li>
        </ol>
      </div>

      <div className="text-center mt-6">
        <Link
          href="/superadmin/tenants"
          className="text-sm text-slate-500 hover:text-brand-navy"
        >
          ← Back to tenants
        </Link>
      </div>
    </div>
  );
}

function SetupCard({
  n,
  title,
  done,
  criticalIfMissing,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  criticalIfMissing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`card mb-4 ${done ? "border-emerald-200 bg-emerald-50/30" : criticalIfMissing ? "border-red-200 bg-red-50/30" : "border-amber-200 bg-amber-50/30"}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
            done ? "bg-emerald-500 text-white" : criticalIfMissing ? "bg-red-500 text-white" : "bg-amber-500 text-white"
          }`}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : criticalIfMissing ? <AlertTriangle className="h-5 w-5" /> : n}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
