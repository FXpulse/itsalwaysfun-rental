// Middleware — runs on every request to:
//   1. Resolve which tenant this request belongs to (by hostname) and
//      inject x-tenant-* headers for server components / API routes
//   2. Refresh the Supabase auth session cookie
//   3. Gate /admin/* routes (redirect unauthenticated → /admin/login)

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantByHostname } from "@/lib/tenant/resolve";

export async function middleware(request: NextRequest) {
  // ─── 1. RESOLVE TENANT ─────────────────────────────────────────────
  // Get hostname from headers (host) — fallback to URL hostname for dev
  const hostname =
    request.headers.get("host") || request.nextUrl.hostname || "localhost";

  const tenant = await resolveTenantByHostname(hostname);

  // Build forwarded headers that server components / API routes can read
  // via headers() — these flow through Next.js request context.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);
  requestHeaders.set("x-tenant-slug", tenant.slug);
  requestHeaders.set("x-tenant-via", tenant.resolved_via);

  // ─── Marketing host → rewrite to /marketing routes ─────────────────
  // getrentalflow.com (apex / www) serves the SaaS marketing pages, not
  // a tenant's rental site. Rewrite root path to /marketing, leave
  // /signup as-is (already a marketing route).
  if (tenant.resolved_via === "marketing") {
    const path = request.nextUrl.pathname;
    if (path === "/") {
      return NextResponse.rewrite(new URL("/marketing", request.url), {
        request: { headers: requestHeaders },
      });
    }
    // /signup, /marketing/*, _next/* etc. pass through
  }

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ─── 2. REFRESH AUTH SESSION ───────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── 3. GATE /admin/* ──────────────────────────────────────────────
  const path = request.nextUrl.pathname;
  const isAdminPath = path.startsWith("/admin");
  const isLoginPath = path === "/admin/login";

  if (isAdminPath && !isLoginPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isLoginPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on every request EXCEPT static assets / images / etc.
  // Tenant resolution needs to happen everywhere — public pages, admin,
  // portal, driver, API routes. Excluding only static file paths.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|images/|sw.js|workbox-|fallback-|manifest.json).*)",
  ],
};
