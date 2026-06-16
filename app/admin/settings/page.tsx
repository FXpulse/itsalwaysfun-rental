import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { CreditCard, Palette, Receipt, ShieldCheck, ExternalLink, Calendar, KeyRound } from "lucide-react";
import { CalendarFeed } from "./CalendarFeed";
import { TimezoneSection } from "./TimezoneSection";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const tenantId = getCurrentTenantId();
  const unscoped = createAdminClient({ unscoped: true });

  const { data: tenant } = await unscoped
    .from("tenants")
    .select("business_name, owner_email, owner_phone, custom_domain, slug, plan, trial_ends_at, stripe_account_id, calendar_feed_token, timezone")
    .eq("id", tenantId)
    .maybeSingle();

  const scoped = createAdminClient();
  const { data: settingsRows } = await scoped
    .from("site_settings")
    .select("key, value")
    .in("key", ["business_address", "business_email"]);
  const settingsMap = new Map<string, string>(
    (settingsRows || []).map((r: any) => [r.key as string, r.value as string]),
  );
  const { count: productCount } = await scoped
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const publicUrl = tenant?.custom_domain
    ? `https://${tenant.custom_domain}`
    : tenant?.slug
    ? `https://${tenant.slug}.getrentalflow.com`
    : "";
  const stripeConnected = !!(tenant as any)?.stripe_account_id;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-6">
        Your business info and account configuration.
      </p>

      {/* Business info */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Business info</h2>
        <dl className="space-y-3 text-sm">
          <Row label="Business name" value={tenant?.business_name || "—"} />
          <Row label="Owner email" value={tenant?.owner_email || "—"} />
          <Row label="Phone" value={(tenant as any)?.owner_phone || "(not set)"} />
          <Row label="Business email" value={settingsMap.get("business_email") || "—"} />
          <Row label="Address" value={settingsMap.get("business_address") || "(not set)"} />
          <Row label="Public site" value={publicUrl} link={publicUrl} />
        </dl>
        <p className="text-xs text-slate-400 mt-4">
          To change business name, logo, or colors, go to{" "}
          <Link href="/admin/settings/branding" className="text-brand-navy underline">
            Branding
          </Link>
          . For phone, email, address, hours, and other public content, go to{" "}
          <Link href="/admin/site" className="text-brand-navy underline">
            Website content
          </Link>
          .
        </p>
      </div>

      {/* Timezone */}
      <TimezoneSection current={(tenant as any)?.timezone || "America/New_York"} />

      {/* Account / Plan */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Plan & billing</h2>
        <dl className="space-y-3 text-sm">
          <Row label="Plan" value={(tenant?.plan || "—").toString().toUpperCase()} />
          <Row
            label="Trial ends"
            value={
              tenant?.trial_ends_at
                ? new Date(tenant.trial_ends_at).toLocaleDateString()
                : "—"
            }
          />
          <Row
            label="Payments (Stripe Connect)"
            value={stripeConnected ? "Connected ✓" : "Not connected"}
          />
        </dl>
        <div className="flex gap-2 mt-4">
          <Link href="/admin/settings/billing" className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1">
            <Receipt className="h-3 w-3" /> Manage billing →
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/admin/settings/payments" className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1">
            <CreditCard className="h-3 w-3" /> Stripe Connect →
          </Link>
        </div>
      </div>

      {/* Inventory snapshot */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Inventory</h2>
        <dl className="space-y-3 text-sm">
          <Row label="Active rental items" value={productCount?.toString() || "0"} />
        </dl>
        <p className="text-xs text-slate-400 mt-4">
          Manage rental items on the{" "}
          <Link href="/admin/products" className="text-brand-navy underline">
            Products
          </Link>{" "}
          page.
        </p>
      </div>

      {/* Calendar feed */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-navy" /> Calendar feed
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Subscribe to your bookings in Google Calendar, Apple Calendar, or Outlook.
          Read-only, auto-refreshes hourly. See <Link href="/admin/help" className="underline">help</Link> for setup steps.
        </p>
        <CalendarFeed token={(tenant as any)?.calendar_feed_token || null} />
      </div>

      {/* Quick links to other settings */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Other settings</h2>
        <ul className="space-y-2 text-sm">
          <QuickLink href="/admin/settings/branding" icon={Palette} label="Branding — logo, colors, business name" />
          <QuickLink href="/admin/settings/payments" icon={CreditCard} label="Payments (Stripe Connect)" />
          <QuickLink href="/admin/settings/billing" icon={Receipt} label="Billing — your RentalFlow subscription" />
          <QuickLink href="/admin/settings/damage-protection" icon={ShieldCheck} label="Damage protection — enable, price, coverage" />
          <QuickLink href="/admin/settings/security" icon={KeyRound} label="Security — two-factor authentication (2FA)" />
        </ul>
      </div>
    </div>
  );
}

function Row({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-slate-100 pb-2">
      <dt className="text-slate-500 w-40 text-sm">{label}</dt>
      <dd className="text-slate-900 font-medium">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-brand-navy hover:underline inline-flex items-center gap-1">
            {value} <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="inline-flex items-center gap-2 text-brand-navy hover:underline"
      >
        <Icon className="h-4 w-4" /> {label}
      </Link>
    </li>
  );
}
