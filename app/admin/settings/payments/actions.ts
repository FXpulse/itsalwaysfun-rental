"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/db";
import {
  createConnectAccount,
  createOnboardingLink,
  createDashboardLoginLink,
  getConnectStatus,
} from "@/lib/stripe/connect";
import { logAuditEvent } from "@/lib/audit";

/** Start (or resume) Stripe Connect onboarding for the current tenant.
 *  Returns the URL the user should be redirected to. */
export async function startStripeOnboarding(): Promise<{
  url?: string;
  error?: string;
}> {
  const me = await requireAdmin();
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  // Fetch tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug, business_name, owner_email, stripe_account_id")
    .eq("id", tenantId)
    .single();

  if (!tenant) return { error: "Tenant not found" };

  let accountId = tenant.stripe_account_id as string | null;

  // Create Connect account if first time
  if (!accountId) {
    try {
      accountId = await createConnectAccount({
        email: tenant.owner_email || me.email || "owner@example.com",
        businessName: tenant.business_name,
      });
      await supabase
        .from("tenants")
        .update({ stripe_account_id: accountId, stripe_account_status: "pending" })
        .eq("id", tenantId);
      await logAuditEvent({
        userEmail: me.email || "unknown",
        action: "stripe_connect.account_created",
        entityType: "tenant",
        entityId: tenantId,
        details: { account_id: accountId },
      });
    } catch (e: any) {
      return { error: `Stripe account creation failed: ${e.message}` };
    }
  }

  // Generate onboarding link
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://www.getrentalflow.com";
  try {
    const url = await createOnboardingLink({
      accountId: accountId!,
      refreshUrl: `${baseUrl}/admin/settings/payments?refresh=1`,
      returnUrl: `${baseUrl}/admin/settings/payments?onboarded=1`,
    });
    return { url };
  } catch (e: any) {
    return { error: `Onboarding link generation failed: ${e.message}` };
  }
}

/** Generate a Stripe Express dashboard link for the current tenant. */
export async function openStripeDashboard(): Promise<{
  url?: string;
  error?: string;
}> {
  await requireAdmin();
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_account_id")
    .eq("id", tenantId)
    .single();

  if (!tenant?.stripe_account_id) {
    return { error: "Stripe not connected yet" };
  }

  try {
    const url = await createDashboardLoginLink(tenant.stripe_account_id);
    return { url };
  } catch (e: any) {
    return { error: `Dashboard link failed: ${e.message}` };
  }
}

/** Refresh + persist the latest Stripe Connect account status. */
export async function refreshStripeStatus(): Promise<{
  status?: string;
  error?: string;
}> {
  const me = await requireAdmin();
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("stripe_account_id, stripe_account_status")
    .eq("id", tenantId)
    .single();

  const fresh = await getConnectStatus(tenant?.stripe_account_id || null);

  if (fresh.status !== tenant?.stripe_account_status) {
    await supabase
      .from("tenants")
      .update({ stripe_account_status: fresh.status })
      .eq("id", tenantId);
    await logAuditEvent({
      userEmail: me.email || "unknown",
      action: "stripe_connect.status_refreshed",
      entityType: "tenant",
      entityId: tenantId,
      details: { old_status: tenant?.stripe_account_status, new_status: fresh.status },
    });
  }
  revalidatePath("/admin/settings/payments");
  return { status: fresh.status };
}
