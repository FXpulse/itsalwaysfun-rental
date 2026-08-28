// Dynamic sitemap.xml — Next.js App Router serves this at /sitemap.xml.
//
// Tenant-aware: the URL host is read from request headers (set by middleware),
// so each tenant domain returns ONLY its own URLs, and the marketing apex
// (getrentalflow.com) returns the SaaS marketing URLs.

import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenant } from "@/lib/tenant/server";

export const revalidate = 3600; // re-generate hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = headers();
  // Same fallback reasoning as app/robots.ts: never publish IAF-specific
  // URLs in other tenants' sitemaps.
  const host = h.get("host") || "getrentalflow.com";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  const tenant = getCurrentTenant();

  // Marketing apex (getrentalflow.com) — SaaS pages, not tenant pages
  if (tenant.isMarketing) {
    const now = new Date();
    return [
      { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
      { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
      { url: `${baseUrl}/free-tools/1099-tracker`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
      { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
      { url: `${baseUrl}/beta`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ];
  }

  // Tenant host — fetch their active products + categories
  const supabase = createAdminClient();
  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_active", true)
      .eq("is_addon", false),
    supabase
      .from("categories")
      .select("slug, updated_at")
      .eq("is_active", true),
  ]);

  const products = productsResult.data || [];
  const categories = categoriesResult.data || [];
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/order-by-date`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/packages`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/gift-cards`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/reviews`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/info/policies`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/info/faqs`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/info/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/info/terms-of-service`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/info/waiver`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/items/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${baseUrl}/category/${c.slug}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...productPages, ...categoryPages];
}
