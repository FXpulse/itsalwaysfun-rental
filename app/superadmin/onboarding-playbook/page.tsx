import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Mail,
  Cloud,
  Phone,
  Database,
  Server,
  CreditCard,
  MessageSquare,
  Search,
  Globe,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SECTIONS: PlaybookSection[] = [
  // ────────────────────────────────────────────────────────────
  {
    id: "rentalflow",
    title: "1. RentalFlow internal",
    icon: Sparkles,
    color: "violet",
    intro:
      "What to do inside the RentalFlow admin/superadmin UI itself when a new tenant signs up.",
    steps: [
      {
        title: "Tenant signs up at getrentalflow.com/signup",
        detail:
          "Stripe Checkout creates the row in tenants table. Default plan from URL param (starter/pro). Default tenant_id is a fresh UUID; slug auto-generated from business_name; timezone defaults to America/New_York.",
      },
      {
        title: "Open /superadmin/tenants/[id]/checklist",
        detail:
          "Walk through the 35-item checklist + fill out the Client Profile (industry, decision maker, market size, etc).",
      },
      {
        title: "Set the right timezone",
        detail:
          "/admin/settings → Timezone dropdown. Critical if tenant is in CA, TX, AZ etc. — UTC default would shift all displayed times.",
      },
      {
        title: "Set custom_domain (if they brought one)",
        detail:
          "Either via /superadmin/tenants/[id] edit or SQL: update tenants set custom_domain = 'example.com' where id = '<id>'.",
      },
      {
        title: "Run any pending SQL migrations",
        detail:
          "Check supabase/ folder for files newer than tenant created_at. Latest required: tenant_onboarding_checklist.sql, add_tenant_timezone.sql, portal_otp_codes.sql.",
        code: `-- Run in Supabase SQL editor (pasted in order)
\\i supabase/tenant_onboarding_checklist.sql
\\i supabase/add_tenant_timezone.sql
\\i supabase/portal_otp_codes.sql`,
      },
      {
        title: "Invite operator as admin",
        detail:
          "/admin/users → Invite → email + role: admin. They get a magic-link to set up their first session.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "vercel",
    title: "2. Vercel",
    icon: Server,
    color: "slate",
    intro:
      "Only needed if the tenant has a CUSTOM DOMAIN (e.g. itsalwaysfun.net). Subdomain tenants (<slug>.getrentalflow.com) work automatically via wildcard.",
    dashboardLink: "https://vercel.com/dashboard",
    steps: [
      {
        title: "Add the tenant's custom domain",
        detail:
          "Vercel Dashboard → tu proyecto → Settings → Domains → Add. Paste the tenant's full domain (e.g. bouncerstx.com). Vercel shows the DNS records the tenant needs to add at their registrar.",
      },
      {
        title: "Wait for SSL cert to issue",
        detail:
          "Usually 30 seconds after DNS propagates. Green check + lock = ready. Vercel can take up to 1 hour during high load.",
      },
      {
        title: "Optional: add 301 redirect from www → apex (or vice versa)",
        detail:
          "Settings → Domains → click the domain → Redirect to → pick canonical. Choose 308 Permanent.",
      },
      {
        title: "If tenant has a parking domain to redirect",
        detail:
          "Same as above. Useful for tenants who own multiple TLDs (e.g. example.net → example.com).",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "dns",
    title: "3. DNS at tenant's registrar",
    icon: Globe,
    color: "blue",
    intro:
      "DNS lives at GoDaddy/Namecheap/Cloudflare/etc. — whatever the tenant uses for their domain. Vercel shows the exact records; just paste them.",
    steps: [
      {
        title: "A record for the apex domain (root)",
        detail: "Hostname: @  |  Value: 76.76.21.21 (Vercel's anycast IP)",
      },
      {
        title: "CNAME record for www subdomain",
        detail: "Hostname: www  |  Value: cname.vercel-dns.com",
      },
      {
        title: "Optional: MX records if tenant wants @theirdomain.com email",
        detail:
          "Point to their email provider (Google Workspace / Microsoft 365 / Cloudflare Email Routing). RentalFlow doesn't touch email delivery — separate decision.",
      },
      {
        title: "Wait for propagation (typically <30 min, max 24h)",
        detail:
          "Check with `dig +short tenantdomain.com` or whatsmydns.net. Vercel will auto-issue SSL once DNS resolves.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "resend",
    title: "4. Resend (transactional email)",
    icon: Mail,
    color: "emerald",
    intro:
      "Currently we send all transactional email from noreply@itsalwaysfun.com (Option B in the OTP setup). For new tenants you have 2 choices.",
    dashboardLink: "https://resend.com/domains",
    steps: [
      {
        title: "Option A (recommended for scale): verify getrentalflow.com",
        detail:
          "One-time platform setup. After verified, all tenants send from noreply@getrentalflow.com. Customer sees: 'RentalFlow <noreply@getrentalflow.com>' with the tenant's brand in the body. Zero per-tenant work afterwards.",
      },
      {
        title: "Option A steps",
        code: `1. Resend Dashboard → Domains → Add Domain
2. Domain: getrentalflow.com
3. Add the 3-4 DNS records Resend shows (DKIM, SPF, return-path)
4. Wait for ✓ verified (usually <30 min)
5. Update Vercel env: EMAIL_FROM=noreply@getrentalflow.com
6. Redeploy`,
      },
      {
        title: "Option B (per-tenant branded): verify tenant's domain",
        detail:
          "Each tenant verifies their own domain in Resend. Customer sees 'YourBusiness <noreply@yourbusiness.com>'. Branded but adds 10 min of setup per tenant.",
      },
      {
        title: "Option B steps (per tenant)",
        code: `1. Resend → Domains → Add Domain → tenant's domain
2. Send tenant the DNS records (DKIM, SPF, return-path)
3. They paste at their registrar
4. Wait for ✓ in Resend
5. Update tenant-specific email config (not yet built — would need code changes)`,
      },
      {
        title: "Update Supabase SMTP if magic links re-enabled",
        detail:
          "We bypass Supabase auth email via custom OTP — so SMTP config in Supabase Authentication → SMTP Settings doesn't matter for OTP. Only update if you reactivate magic links later.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "supabase",
    title: "5. Supabase",
    icon: Database,
    color: "indigo",
    intro:
      "Multi-tenant RLS handles isolation automatically. The only per-tenant setup is data + redirect URLs (if magic links).",
    dashboardLink: "https://supabase.com/dashboard",
    steps: [
      {
        title: "Confirm tenant row exists",
        detail:
          "Supabase SQL Editor → select * from tenants where slug = '<their-slug>'. Should return 1 row with their info.",
      },
      {
        title: "Authentication → URL Configuration (only if using magic links)",
        detail:
          "We use custom OTP now (lib/portal/login) — Supabase auth URL config isn't used for portal. Skip this section unless re-enabling magic links.",
      },
      {
        title: "Storage buckets",
        detail:
          "Existing buckets (site-assets, backups) are shared across tenants. Files are organized by /tenants/<tenant_id>/... — no per-tenant bucket creation needed.",
      },
      {
        title: "RLS policies",
        detail:
          "All multi-tenant tables have tenant_isolation policy via current_tenant_id() function (see supabase/multi_tenant_rls.sql). New tables MUST be added to that policy if they store tenant data.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "stripe",
    title: "6. Stripe Connect (payments)",
    icon: CreditCard,
    color: "violet",
    intro:
      "Each tenant connects their OWN Stripe account so customer payments land in their bank. Platform-level Connect must be activated once (already done for RentalFlow). Then per-tenant onboarding via the existing UI.",
    dashboardLink: "https://dashboard.stripe.com/connect",
    steps: [
      {
        title: "Tenant clicks 'Connect Stripe' in /admin/settings/payments",
        detail:
          "Redirects to Stripe Express onboarding. Tenant fills in business info, bank account, statement descriptor (~5 min).",
      },
      {
        title: "Returns to RentalFlow with status: active",
        detail:
          "tenants.stripe_account_id and stripe_account_status get populated automatically via webhook + return URL.",
      },
      {
        title: "No platform action needed",
        detail:
          "Webhook (Stripe events → /api/webhooks/stripe) routes payments to the tenant's connected account using tenant_id metadata.",
      },
      {
        title: "If onboarding stalls",
        detail:
          "Stripe Connect dashboard → Connected Accounts → find tenant → Resume onboarding. Common holdups: missing EIN, wrong business type, bank micro-deposits pending.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "twilio",
    title: "7. Twilio SMS (optional)",
    icon: Phone,
    color: "amber",
    intro:
      "Currently TWILIO_FROM_NUMBER is platform-shared — all tenants' SMS come from one number. For per-tenant branded numbers we'd need code changes.",
    dashboardLink: "https://console.twilio.com/",
    steps: [
      {
        title: "Current setup (1 shared toll-free number)",
        detail:
          "3 env vars in Vercel: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (E.164). SMS fires for booking confirmation + 3-day reminder via lib/sms/send.ts.",
      },
      {
        title: "Verification required before sending",
        detail:
          "Toll-Free Verification (5-14 days) for TFN, or A2P 10DLC (1-3 days low-volume) for long-code. Check status: Console → Messaging → Regulatory Compliance.",
      },
      {
        title: "Per-tenant numbers (future enhancement)",
        detail:
          "Would require tenants.twilio_from_number column + refactor sendSms() to pick per-tenant. Not built yet.",
      },
      {
        title: "Skip Twilio entirely",
        detail:
          "If a tenant doesn't want SMS, just leave env vars empty for them — code degrades gracefully (isSmsConfigured() returns false, sends skipped silently).",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "cloudflare",
    title: "8. Cloudflare (optional)",
    icon: Cloud,
    color: "orange",
    intro:
      "Only used if tenant routes emails via Cloudflare Email Routing (e.g. bookings@theirdomain.com → forwarded to their inbox). Skip if they use Google Workspace / M365.",
    dashboardLink: "https://dash.cloudflare.com/",
    steps: [
      {
        title: "Add domain to Cloudflare (if not already)",
        detail:
          "Cloudflare → Add a site → tenant's domain. Update nameservers at registrar. Free plan is fine.",
      },
      {
        title: "Enable Email Routing",
        detail:
          "Cloudflare → Email → Email Routing → Enable. Adds MX records automatically.",
      },
      {
        title: "Set up routing rules",
        detail:
          "Custom address: bookings@tenant.com  |  Action: Send to operator's personal inbox. Repeat for info@, support@, etc.",
      },
      {
        title: "Optional: Email Worker for custom processing",
        detail:
          "cloudflare/email-worker.js in the repo. Forwards bookings@itsalwaysfun.net to a webhook that creates tickets in /admin/inbox. Replicate per-tenant if needed.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "google",
    title: "9. Google (SEO + Business Profile)",
    icon: Search,
    color: "rose",
    intro:
      "Help the tenant claim/manage their Google presence. Affects local search ranking, which is critical for rental businesses.",
    steps: [
      {
        title: "Google Search Console — add property",
        detail:
          "search.google.com/search-console → Add property → URL prefix → tenant's full URL. Verify via DNS TXT record or HTML upload (DNS is more durable).",
      },
      {
        title: "Submit sitemap",
        detail:
          "GSC → Sitemaps → submit https://tenant-domain.com/sitemap.xml. The site auto-generates one (app/sitemap.ts) with all products, FAQs, policies.",
      },
      {
        title: "Google Business Profile (formerly GMB)",
        detail:
          "business.google.com → claim listing → set website to RentalFlow URL, hours, photos, services. Reviews here boost local SEO significantly.",
      },
      {
        title: "Optional: Bing Webmaster Tools",
        detail:
          "webmaster.bing.com → import from GSC (saves time). Bing handles 5-10% of US search.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "ghl",
    title: "10. GoHighLevel (optional)",
    icon: MessageSquare,
    color: "fuchsia",
    intro:
      "RentalFlow has its own AI chat, campaigns, and customer management. GHL is only needed if the tenant uses it for outbound (cold email, lead nurture) or WhatsApp / voice calling.",
    steps: [
      {
        title: "Create sub-account in GHL agency",
        detail:
          "Required if tenant wants GHL features. Use the playbook at C:\\Users\\chemm\\getrentalflow-ghl-playbook.md for full setup (pipelines, workflows, chatbot KB).",
      },
      {
        title: "Connect via webhook (optional)",
        detail:
          "Set GHL_REFERRAL_WEBHOOK_URL in Vercel to push commission events. Or use the public webhook (/api/webhooks/ghl) for inbound contact creation.",
      },
      {
        title: "Most tenants don't need GHL",
        detail:
          "RentalFlow now handles 16+ email templates, customer tags, campaign sender, AI chat. GHL adds value mainly for outbound cold prospecting which is operator-side (Ludmila's RentalFlow outreach), not tenant-side.",
      },
    ],
  },
];

interface PlaybookStep {
  title: string;
  detail?: string;
  code?: string;
}

interface PlaybookSection {
  id: string;
  title: string;
  icon: any;
  color: string;
  intro: string;
  dashboardLink?: string;
  steps: PlaybookStep[];
}

const COLOR_BG: Record<string, string> = {
  slate: "bg-slate-100 text-slate-800 border-slate-300",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-300",
  violet: "bg-violet-100 text-violet-800 border-violet-300",
  amber: "bg-amber-100 text-amber-800 border-amber-300",
  orange: "bg-orange-100 text-orange-800 border-orange-300",
  rose: "bg-rose-100 text-rose-800 border-rose-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  fuchsia: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
};

export default async function OnboardingPlaybookPage() {
  // Auth gate
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const admin = createAdminClient({ unscoped: true });
  const { data: role } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!role) redirect("/superadmin/login?error=not_superadmin");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Link
        href="/superadmin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy"
      >
        <ChevronLeft className="h-4 w-4" /> Back to superadmin dashboard
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-navy via-indigo-700 to-violet-700 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 mb-2">
          <Sparkles className="h-3 w-3" />
          New Tenant Onboarding
        </div>
        <h1 className="text-3xl font-bold mb-2">Platform Onboarding Playbook</h1>
        <p className="text-sm text-white/85">
          Everything that needs to happen across Vercel, Supabase, Resend, Stripe,
          Twilio, Cloudflare, Google, and GHL when a new tenant joins RentalFlow.
          Tick through each section — most steps are one-time or skip-able.
        </p>
      </div>

      {/* TOC */}
      <div className="card p-4">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Jump to section
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`inline-flex items-center gap-2 px-2 py-1.5 rounded border text-xs hover:shadow ${COLOR_BG[s.color]}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.title}
              </a>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <section key={s.id} id={s.id} className="card p-5 scroll-mt-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`shrink-0 p-2 rounded-lg ${COLOR_BG[s.color]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-brand-navy">{s.title}</h2>
                  <p className="text-sm text-slate-600 mt-0.5">{s.intro}</p>
                </div>
              </div>
              {s.dashboardLink && (
                <a
                  href={s.dashboardLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                >
                  Dashboard <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <ol className="space-y-3 mt-4">
              {s.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="shrink-0 bg-brand-navy text-white font-bold rounded-full h-6 w-6 flex items-center justify-center text-xs">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800">{step.title}</div>
                    {step.detail && <p className="text-xs text-slate-600 mt-0.5">{step.detail}</p>}
                    {step.code && (
                      <pre className="mt-2 bg-slate-900 text-slate-100 text-[11px] font-mono p-3 rounded-md overflow-x-auto leading-relaxed">
                        {step.code}
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      {/* Help footer */}
      <div className="card bg-slate-50 p-5 text-center">
        <h3 className="font-bold text-slate-700 text-sm mb-1">Missing a service?</h3>
        <p className="text-xs text-slate-600">
          This playbook lives at <code className="bg-white px-1 rounded">app/superadmin/onboarding-playbook/page.tsx</code>
          {" "}— edit it directly to add sections. Add new ones to the SECTIONS array.
        </p>
      </div>
    </div>
  );
}
