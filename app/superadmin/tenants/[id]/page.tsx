import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ExternalLink,
  Crown,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Building,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantActionsPanel } from "./TenantActionsPanel";
import { TenantBrief } from "./TenantBrief";
import { evaluateChecklist } from "@/lib/superadmin/tenant-checklist";
import { ClipboardList } from "lucide-react";
import { z } from "zod";

export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Auth — superadmin only
  const authClient = createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/superadmin/login");

  const admin = createAdminClient({ unscoped: true });
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!roleRow) redirect("/superadmin/login?error=not_superadmin");

  if (!IdSchema.safeParse(params.id).success) notFound();

  // Fetch tenant + all stats in parallel
  const [
    { data: tenant },
    { count: bookingsCount },
    { data: revenueRow },
    { count: customersCount },
    { count: productsCount },
    { data: lastBooking },
    { count: contactCount },
    { data: lastAudit },
  ] = await Promise.all([
    admin.from("tenants").select("*").eq("id", params.id).maybeSingle(),
    admin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", params.id),
    admin
      .from("bookings")
      .select("total_amount.sum()")
      .eq("tenant_id", params.id)
      .eq("stripe_payment_status", "paid")
      .neq("booking_status", "cancelled")
      .single(),
    admin
      .from("bookings")
      .select("customer_email", { count: "exact", head: true })
      .eq("tenant_id", params.id),
    admin
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", params.id)
      .eq("is_active", true),
    admin
      .from("bookings")
      .select("event_date, customer_first_name, customer_last_name, total_amount")
      .eq("tenant_id", params.id)
      .order("event_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", params.id)
      .eq("is_resolved", false),
    admin
      .from("admin_audit_log")
      .select("action, user_email, created_at")
      .eq("tenant_id", params.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (!tenant) notFound();

  const revenue = (revenueRow as any)?.sum || 0;
  const tenantUrl = tenant.custom_domain
    ? `https://${tenant.custom_domain}`
    : `https://${tenant.slug}.getrentalflow.com`;

  // Checklist progress for header CTA (defensive — tables may not exist yet)
  let checklist: { pct: number; completed: number; total: number; required_total: number; required_completed: number } | null = null;
  try {
    const c = await evaluateChecklist(tenant.id);
    checklist = {
      pct: c.pct,
      completed: c.completed,
      total: c.total,
      required_total: c.required_total,
      required_completed: c.required_completed,
    };
  } catch (e) {
    checklist = null;
  }
  const checklistColor = !checklist ? "bg-slate-100 text-slate-700"
    : checklist.pct >= 90 ? "bg-emerald-100 text-emerald-800"
    : checklist.pct >= 60 ? "bg-blue-100 text-blue-800"
    : checklist.pct >= 30 ? "bg-amber-100 text-amber-800"
    : "bg-rose-100 text-rose-800";

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Link
        href="/superadmin/tenants"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to all tenants
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2 flex-wrap">
            {tenant.business_name}
            {tenant.plan === "founder" && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded">
                <Crown className="h-3 w-3" /> FOUNDER
              </span>
            )}
            {tenant.suspended_at && (
              <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded">
                SUSPENDED
              </span>
            )}
          </h1>
          <div className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            <span className="font-mono">{tenant.slug}</span>
            <span>·</span>
            <a
              href={tenantUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-navy hover:underline inline-flex items-center gap-1"
            >
              {tenantUrl.replace("https://", "")} <ExternalLink className="h-3 w-3" />
            </a>
            {tenant.custom_domain && (
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">custom domain</span>
            )}
          </div>
        </div>
        <TenantActionsPanel
          tenantId={tenant.id}
          tenantUrl={tenantUrl}
          isSuspended={!!tenant.suspended_at}
          suspendedReason={tenant.suspended_reason}
          stripeCustomerId={tenant.stripe_customer_id}
          stripeAccountId={tenant.stripe_account_id}
        />
      </div>

      {/* Checklist CTA */}
      <Link
        href={`/superadmin/tenants/${tenant.id}/checklist`}
        className={`group flex items-center justify-between mb-6 rounded-xl border-2 ${
          checklist && checklist.pct === 100 ? "border-emerald-300 bg-emerald-50" : "border-indigo-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50"
        } p-4 hover:shadow-md transition`}
      >
        <div className="flex items-center gap-3">
          <ClipboardList className={`h-6 w-6 ${checklist && checklist.pct === 100 ? "text-emerald-600" : "text-indigo-600"}`} />
          <div>
            <div className="font-bold text-brand-navy flex items-center gap-2">
              Onboarding Checklist · Ficha del Cliente
              {checklist ? (
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${checklistColor}`}>
                  {checklist.completed}/{checklist.total} · {checklist.pct}%
                </span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  Run SQL migration to enable
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {!checklist
                ? "Tables not yet created. Run supabase/tenant_onboarding_checklist.sql"
                : checklist.required_total - checklist.required_completed > 0
                ? `${checklist.required_total - checklist.required_completed} required item(s) pending`
                : "All required items complete · view full breakdown →"}
            </div>
          </div>
        </div>
        <div className="text-xs text-indigo-700 font-semibold group-hover:underline">
          Open →
        </div>
      </Link>

      {/* GHL config CTA */}
      <Link
        href={`/superadmin/tenants/${tenant.id}/ghl`}
        className={`group flex items-center justify-between mb-6 rounded-xl border-2 ${
          (tenant as any).ghl_location_id
            ? "border-emerald-300 bg-emerald-50"
            : "border-amber-300 bg-amber-50"
        } p-4 hover:shadow-md transition`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-6 w-6 rounded ${
              (tenant as any).ghl_location_id ? "bg-emerald-200" : "bg-amber-200"
            } flex items-center justify-center text-xs font-bold`}
          >
            GHL
          </div>
          <div>
            <div className="font-bold text-brand-navy">
              GoHighLevel sub-account
              {(tenant as any).ghl_location_id ? (
                <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                  Configured
                </span>
              ) : (
                <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  Not configured
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {(tenant as any).ghl_location_id
                ? `Location ${((tenant as any).ghl_location_id as string).slice(0, 12)}… — bookings + contacts push to this sub-account`
                : "Provision a sub-account in HighLevel, then paste Location ID + workflow webhook URLs here"}
            </div>
          </div>
        </div>
        <div className="text-xs font-semibold group-hover:underline">
          {(tenant as any).ghl_location_id ? "Edit →" : "Configure →"}
        </div>
      </Link>

      {/* Twilio SMS config CTA */}
      <Link
        href={`/superadmin/tenants/${tenant.id}/sms`}
        className={`group flex items-center justify-between mb-6 rounded-xl border-2 ${
          (tenant as any).twilio_from_number
            ? "border-emerald-300 bg-emerald-50"
            : "border-amber-300 bg-amber-50"
        } p-4 hover:shadow-md transition`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-6 w-6 rounded ${
              (tenant as any).twilio_from_number ? "bg-emerald-200" : "bg-amber-200"
            } flex items-center justify-center text-xs font-bold`}
          >
            SMS
          </div>
          <div>
            <div className="font-bold text-brand-navy">
              Twilio SMS number
              {(tenant as any).twilio_from_number ? (
                <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                  Configured
                </span>
              ) : (
                <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  Not configured
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {(tenant as any).twilio_from_number
                ? `Customer SMS sends from ${(tenant as any).twilio_from_number}`
                : "Buy a Twilio number in the platform console, paste it here to enable SMS for this tenant's customers"}
            </div>
          </div>
        </div>
        <div className="text-xs font-semibold group-hover:underline">
          {(tenant as any).twilio_from_number ? "Edit →" : "Configure →"}
        </div>
      </Link>

      {/* AI Brief panel */}
      <div className="mb-6">
        <TenantBrief tenantId={tenant.id} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Total bookings" value={String(bookingsCount || 0)} />
        <Stat
          label="Lifetime revenue"
          value={`$${((revenue || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color="emerald"
        />
        <Stat label="Customer records" value={String(customersCount || 0)} />
        <Stat label="Active products" value={String(productsCount || 0)} />
        <Stat
          label="Unresolved inbox"
          value={String(contactCount || 0)}
          color={(contactCount || 0) > 0 ? "amber" : "slate"}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Tenant info */}
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
            <Building className="h-4 w-4" /> Account
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Plan" value={<PlanBadge plan={tenant.plan} />} />
            <Row label="Created" value={new Date(tenant.created_at).toLocaleDateString()} />
            {tenant.trial_ends_at && (
              <Row
                label="Trial ends"
                value={new Date(tenant.trial_ends_at).toLocaleDateString()}
              />
            )}
            <Row
              label="Owner email"
              value={
                <a
                  href={`mailto:${tenant.owner_email}`}
                  className="text-brand-navy hover:underline inline-flex items-center gap-1"
                >
                  <Mail className="h-3 w-3" /> {tenant.owner_email}
                </a>
              }
            />
            {tenant.owner_phone && (
              <Row
                label="Owner phone"
                value={
                  <a
                    href={`tel:${tenant.owner_phone.replace(/\D/g, "")}`}
                    className="text-brand-navy hover:underline inline-flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" /> {tenant.owner_phone}
                  </a>
                }
              />
            )}
            {lastBooking && (
              <Row
                label="Last booking"
                value={
                  <span className="text-xs">
                    {lastBooking.event_date} · {lastBooking.customer_first_name}{" "}
                    {lastBooking.customer_last_name} · $
                    {((lastBooking.total_amount || 0) / 100).toFixed(0)}
                  </span>
                }
              />
            )}
          </dl>
        </div>

        {/* Stripe info */}
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
            <CreditCard className="h-4 w-4" /> Stripe
          </h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="Subscription"
              value={
                tenant.subscription_status ? (
                  <span className="capitalize">{tenant.subscription_status.replace(/_/g, " ")}</span>
                ) : (
                  <span className="text-slate-400">No subscription</span>
                )
              }
            />
            {tenant.current_period_end && (
              <Row
                label={tenant.cancel_at_period_end ? "Cancels on" : "Renews on"}
                value={new Date(tenant.current_period_end).toLocaleDateString()}
              />
            )}
            {tenant.stripe_customer_id && (
              <Row
                label="Customer ID"
                value={
                  <a
                    href={`https://dashboard.stripe.com/customers/${tenant.stripe_customer_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-navy hover:underline font-mono text-xs"
                  >
                    {tenant.stripe_customer_id}
                  </a>
                }
              />
            )}
            {tenant.stripe_account_id && (
              <Row
                label="Connect account"
                value={
                  <a
                    href={`https://dashboard.stripe.com/connect/accounts/${tenant.stripe_account_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-navy hover:underline font-mono text-xs"
                  >
                    {tenant.stripe_account_id}
                  </a>
                }
              />
            )}
            {tenant.stripe_account_status && (
              <Row
                label="Connect status"
                value={
                  <span className="capitalize text-xs">
                    {tenant.stripe_account_status}
                  </span>
                }
              />
            )}
            {!tenant.stripe_customer_id && !tenant.stripe_account_id && (
              <p className="text-xs text-slate-400 italic">
                Tenant hasn't connected Stripe Connect or started a subscription yet.
              </p>
            )}
          </dl>
        </div>

        {/* Recent audit activity */}
        <div className="card md:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
            <Calendar className="h-4 w-4" /> Recent admin activity
          </h2>
          {((lastAudit as any[]) || []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No audit entries yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(lastAudit as any[]).map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
                >
                  <span>
                    <span className="font-mono text-slate-700">{a.action}</span>
                    <span className="text-slate-500"> · by {a.user_email}</span>
                  </span>
                  <span className="text-slate-400">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Branding preview */}
      {tenant.branding && Object.keys(tenant.branding as any).length > 0 && (
        <div className="card mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Branding
          </h2>
          <div className="flex items-center gap-4 text-sm">
            {(tenant.branding as any).logo_url && (
              <img
                src={(tenant.branding as any).logo_url}
                alt={tenant.business_name + " logo"}
                className="h-12 w-auto"
              />
            )}
            <div className="flex items-center gap-2 text-xs">
              <span>Primary:</span>
              <span
                className="inline-block w-6 h-6 rounded border border-slate-300"
                style={{
                  backgroundColor: (tenant.branding as any).primary_color || "#1a1a6e",
                }}
              />
              <code className="font-mono">
                {(tenant.branding as any).primary_color || "(default)"}
              </code>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>Accent:</span>
              <span
                className="inline-block w-6 h-6 rounded border border-slate-300"
                style={{
                  backgroundColor: (tenant.branding as any).accent_color || "#FFD700",
                }}
              />
              <code className="font-mono">
                {(tenant.branding as any).accent_color || "(default)"}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: string;
  color?: "slate" | "emerald" | "amber" | "red";
}) {
  const cls = {
    slate: "bg-slate-50 border-slate-200 text-slate-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    red: "bg-red-50 border-red-200 text-red-800",
  }[color];
  return (
    <div className={`rounded p-3 border ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-bold font-mono mt-1">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-slate-100 pb-1 last:border-0">
      <dt className="text-slate-500 w-32 text-xs uppercase tracking-wider flex-shrink-0">
        {label}
      </dt>
      <dd className="text-slate-800 flex-1">{value}</dd>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "founder") {
    return (
      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">
        <Crown className="h-3 w-3" /> Founder
      </span>
    );
  }
  return (
    <span className="capitalize bg-slate-100 px-2 py-0.5 rounded text-xs">{plan}</span>
  );
}
