// Security headers applied to every response. Tuned to allow:
//   - Stripe (js.stripe.com, m.stripe.com, hooks.stripe.com)
//   - Supabase (*.supabase.co)
//   - GoHighLevel chat widget (beta.leadconnectorhq.com, msgsndr.com)
//   - Sentry (*.ingest.sentry.io)
//   - Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
//
// CSP uses 'unsafe-inline' for styles (required by Next.js + many libs) and
// for scripts (required by Stripe.js inline init + Next.js hydration markers).
// Strict-Transport-Security forces HTTPS-only access from supporting browsers.
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.com https://beta.leadconnectorhq.com https://msgsndr.com https://*.googletagmanager.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://m.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://beta.leadconnectorhq.com https://services.leadconnectorhq.com https://msgsndr.com wss://msgsndr.com https://www.google-analytics.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://beta.leadconnectorhq.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.stripe.com",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mark Node-only modules as external so webpack does NOT bundle them and
  // they're loaded with require() at runtime instead. Critical for libraries
  // that depend on native modules or Node built-ins (mailparser, imapflow,
  // nodemailer have transitive deps that break when bundled).
  experimental: {
    serverComponentsExternalPackages: [
      "mailparser",
      "imapflow",
      "nodemailer",
      "isomorphic-dompurify",
    ],
    // Server actions default body limit is 1 MB — mobile photos from iPhone
    // are 3-5 MB typical so the limit was silently failing photo uploads from
    // the driver flow. Raise to 10 MB (still under the 5 MB cap in
    // lib/storage/upload.ts maxBytes, but with some headroom for multipart
    // overhead).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "itsalwaysfun.com" },
      { protocol: "https", hostname: "itsalwaysfun.net" },
      { protocol: "https", hostname: "files.sysers.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

// Compose wrappers in order: nextConfig → withPWA → withSentryConfig.
// Each layer is optional and degrades gracefully if its dependency or
// env vars are missing.

let exported = nextConfig;

// PWA layer — registers service worker for offline + installability.
// Disabled in dev mode to avoid SW cache fighting hot-reload.
try {
  const withPWA = require("next-pwa")({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
    // Don't pre-cache auth pages or stale-cache admin (security + freshness)
    publicExcludes: ["!noprecache/**/*"],
    buildExcludes: [/middleware-manifest\.json$/],
  });
  exported = withPWA(exported);
} catch (e) {
  console.warn("[pwa] next-pwa not installed — skipping wrap");
}

// Sentry layer — only when DSN configured
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    const { withSentryConfig } = require("@sentry/nextjs");
    exported = withSentryConfig(exported, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    });
  } catch (e) {
    console.warn("[sentry] @sentry/nextjs not installed — skipping wrap");
  }
}

module.exports = exported;
