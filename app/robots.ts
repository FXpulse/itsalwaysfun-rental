// robots.txt — Next.js App Router serves this at /robots.txt.
//
// Allow public pages to be indexed; block admin / portal / driver / API.
// Sitemap URL is built from the request host so every tenant + the marketing
// apex point at their own /sitemap.xml.

import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default function robots(): MetadataRoute.Robots {
  const h = headers();
  const host = h.get("host") || "itsalwaysfun.net";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/superadmin/",
          "/portal/",
          "/driver/",
          "/api/",
          "/quotes/",
          "/checkout",
          "/_next/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
