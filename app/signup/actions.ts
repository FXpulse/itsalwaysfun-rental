"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";

const SignupInput = z.object({
  business_name: z.string().min(2).max(200),
  owner_email: z.string().email(),
  owner_phone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(100),
  desired_slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "lowercase letters, numbers, hyphens (no leading/trailing hyphen)"),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "tenant";
}

export async function checkSlugAvailable(slug: string): Promise<{
  available: boolean;
  reason?: string;
}> {
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.length < 2) {
    return { available: false, reason: "Invalid format" };
  }
  // Reserve some slugs
  const reserved = ["www", "admin", "api", "app", "marketing", "signup",
    "login", "help", "docs", "support", "blog", "status", "dashboard"];
  if (reserved.includes(slug)) {
    return { available: false, reason: "Reserved" };
  }
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return { available: !data };
}

export interface SignupResult {
  ok: boolean;
  error?: string;
  tenant_slug?: string;
  redirect_url?: string;
}

export async function signupTenant(formData: FormData): Promise<SignupResult> {
  const rawSlug =
    String(formData.get("desired_slug") || "").trim().toLowerCase() ||
    slugify(String(formData.get("business_name") || ""));

  const parsed = SignupInput.safeParse({
    business_name: String(formData.get("business_name") || "").trim(),
    owner_email: String(formData.get("owner_email") || "").trim().toLowerCase(),
    owner_phone: String(formData.get("owner_phone") || "").trim() || null,
    password: String(formData.get("password") || ""),
    desired_slug: rawSlug,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    };
  }

  // Slug availability
  const avail = await checkSlugAvailable(parsed.data.desired_slug);
  if (!avail.available) {
    return {
      ok: false,
      error: `Subdomain "${parsed.data.desired_slug}" is not available (${avail.reason || "taken"}). Try a different one.`,
    };
  }

  const supabase = createAdminClient({ unscoped: true });

  // 1. Create auth user (Supabase Auth)
  const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
    email: parsed.data.owner_email,
    password: parsed.data.password,
    email_confirm: true,  // Skip email verification for SaaS signup (they can confirm via password reset if lost)
  });
  if (userErr || !userData?.user) {
    return {
      ok: false,
      error: `User creation failed: ${userErr?.message || "unknown error"}`,
    };
  }
  const userId = userData.user.id;

  // 2. Create tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      slug: parsed.data.desired_slug,
      business_name: parsed.data.business_name,
      owner_email: parsed.data.owner_email,
      owner_phone: parsed.data.owner_phone,
      plan: "pro",  // single-tier $99/mo — everyone gets Pro
      trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),  // 30-day trial
    })
    .select("id, slug")
    .single();

  if (tenantErr || !tenant) {
    // Rollback the user
    await supabase.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error: `Tenant creation failed: ${tenantErr?.message || "unknown"}`,
    };
  }

  // 3. Promote user as admin of this tenant
  const { error: roleErr } = await supabase.from("user_roles").insert({
    user_id: userId,
    tenant_id: tenant.id,
    role: "admin",
    is_active: true,
    is_superadmin: false,
  });
  if (roleErr) {
    // Best effort rollback
    await supabase.from("tenants").delete().eq("id", tenant.id);
    await supabase.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error: `Role assignment failed: ${roleErr.message}`,
    };
  }

  // 4. Seed minimal data: a "general" category so they can add products
  await supabase
    .from("categories")
    .insert({
      tenant_id: tenant.id,
      name: "General",
      slug: "general",
      display_order: 0,
      is_active: true,
    })
    .select("id");

  // 5. Audit
  await logAuditEvent({
    userEmail: parsed.data.owner_email,
    action: "tenant.created",
    entityType: "tenant",
    entityId: tenant.id,
    details: {
      slug: tenant.slug,
      business_name: parsed.data.business_name,
      plan: "pro",
      trial_days: 30,
    },
  });

  // 6. Redirect to the tenant's subdomain admin login
  const redirectUrl = `https://${tenant.slug}.getrentalflow.com/admin/login`;

  return {
    ok: true,
    tenant_slug: tenant.slug,
    redirect_url: redirectUrl,
  };
}
