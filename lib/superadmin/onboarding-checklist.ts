// Onboarding completion checklist for a tenant.
//
// Builds a 6-step checklist + completion %. Used for:
//   - /superadmin/onboarding grid view
//   - Per-tenant card on /superadmin/tenants/[id]
//   - Auto-nudge cron (decides which email to send)

import { createAdminClient } from "@/lib/supabase/admin";

export interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
  hint?: string;
}

export interface OnboardingStatus {
  items: OnboardingItem[];
  completed: number;
  total: number;
  percentage: number;
  is_stalled: boolean;     // <50% AND >5 days old AND not paying
  days_since_signup: number;
  next_step: string;       // what to nudge them about
}

export async function fetchOnboardingForTenant(tenantId: string): Promise<OnboardingStatus | null> {
  const supabase = createAdminClient({ unscoped: true });

  // Pull tenant + site_settings + product count + Stripe connection + bookings count
  const [
    tenantResult,
    settingsResult,
    productsCountResult,
    bookingsCountResult,
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("created_at, business_name, plan, subscription_status, stripe_account_id, custom_domain")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("site_settings")
      .select("key, value")
      .eq("tenant_id", tenantId),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  const tenant = tenantResult.data as any;
  if (!tenant) return null;

  const settings = new Map<string, string>(
    ((settingsResult.data as Array<{ key: string; value: string }>) || []).map((s) => [s.key, s.value]),
  );

  const items: OnboardingItem[] = [
    {
      key: "business_info",
      label: "Set business name + phone + address",
      done: !!settings.get("business_name") && !!settings.get("business_phone") && !!settings.get("business_address"),
      hint: "/admin/site → Business info",
    },
    {
      key: "logo",
      label: "Upload logo",
      done: !!settings.get("logo_url"),
      hint: "/admin/site → Logo upload",
    },
    {
      key: "first_product",
      label: "Add first rental product",
      done: (productsCountResult.count ?? 0) > 0,
      hint: "/admin/products → Add product",
    },
    {
      key: "stripe_connect",
      label: "Connect Stripe to accept payments",
      done: !!tenant.stripe_account_id,
      hint: "/admin/settings/payments → Connect Stripe",
    },
    {
      key: "first_booking",
      label: "Take first booking",
      done: (bookingsCountResult.count ?? 0) > 0,
      hint: "Share booking page with a real customer",
    },
    {
      key: "domain_or_seo",
      label: "Connect custom domain or verify Google",
      done: !!tenant.custom_domain || !!settings.get("seo_google_verification"),
      hint: "/admin/site → Domain or SEO Google Verification",
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const percentage = Math.round((completed / total) * 100);

  const days_since_signup = Math.floor(
    (Date.now() - new Date(tenant.created_at).getTime()) / 86_400_000,
  );

  const is_paying = tenant.subscription_status === "active" || tenant.plan === "founder";
  const is_stalled = !is_paying && percentage < 50 && days_since_signup > 5;

  const next_step = items.find((i) => !i.done)?.label || "All set!";

  return {
    items,
    completed,
    total,
    percentage,
    is_stalled,
    days_since_signup,
    next_step,
  };
}

export async function fetchAllOnboarding(): Promise<Array<{
  id: string;
  business_name: string;
  plan: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  status: OnboardingStatus;
}>> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, business_name, plan, subscription_status, trial_ends_at, created_at")
    .order("created_at", { ascending: false });

  if (!tenants) return [];

  const out = await Promise.all((tenants as any[]).map(async (t) => {
    const status = await fetchOnboardingForTenant(t.id);
    return {
      id: t.id,
      business_name: t.business_name || "(unnamed)",
      plan: t.plan || "starter",
      subscription_status: t.subscription_status,
      trial_ends_at: t.trial_ends_at,
      status: status || {
        items: [], completed: 0, total: 6, percentage: 0,
        is_stalled: false, days_since_signup: 0, next_step: "—",
      },
    };
  }));

  return out;
}
