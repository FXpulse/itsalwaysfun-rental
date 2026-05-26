/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "itsalwaysfun.com" },
      { protocol: "https", hostname: "itsalwaysfun.net" },
      { protocol: "https", hostname: "files.sysers.com" },
    ],
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
