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

  // /free-tools/* only lives on the marketing apex. If a tenant subdomain or
  // custom domain hits these URLs, send them to the apex so they don't get a
  // tenant-branded version of the lead-magnet pages.
  if (
    request.nextUrl.pathname.startsWith("/free-tools") &&
    tenant.resolved_via !== "marketing"
  ) {
    const apex = "https://getrentalflow.com" + request.nextUrl.pathname + request.nextUrl.search;
    return NextResponse.redirect(apex);
  }

  // Build forwarded headers that server components / API routes can read
  // via headers() — these flow through Next.js request context.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);
  requestHeaders.set("x-tenant-slug", tenant.slug);
  requestHeaders.set("x-tenant-via", tenant.resolved_via);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  // ─── Marketing host (getrentalflow.com apex) routing ──────────────
  //   - "/" → rewrite to /marketing landing
  //   - "/admin/*" → redirect to /superadmin/login (no tenant here)
  //   - "/portal/*" or "/driver/*" → redirect to "/" (tenant-only routes)
  //   - /signup, /superadmin/*, /marketing/* → pass through
  //
  // The "marketing" sentinel is also used when a *.getrentalflow.com
  // subdomain doesn't match any tenant — we redirect the whole request
  // to the apex marketing page (not just the path) so the user lands
  // on getrentalflow.com instead of seeing a confusing IAF render.
  if (tenant.resolved_via === "marketing") {
    const path = request.nextUrl.pathname;

    // If we're on a tenant subdomain that doesn't exist, send them to
    // the apex marketing site entirely.
    if (hostname.endsWith(".getrentalflow.com") && hostname !== "www.getrentalflow.com") {
      return NextResponse.redirect("https://getrentalflow.com/");
    }

    if (path === "/") {
      return NextResponse.rewrite(new URL("/marketing", request.url), {
        request: { headers: requestHeaders },
      });
    }
    if (path.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/superadmin/login";
      return NextResponse.redirect(url);
    }
    if (path.startsWith("/portal") || path.startsWith("/driver")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
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
