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

// Sentry wrapping: only applied if SENTRY_DSN env var is set.
// If Sentry isn't configured yet (no DSN), the app builds + runs normally.
let exported = nextConfig;
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    const { withSentryConfig } = require("@sentry/nextjs");
    exported = withSentryConfig(nextConfig, {
      // Sentry source-map upload options. Org + project are required for
      // source maps. Get them from your Sentry project URL.
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN, // for CI uploads
      silent: !process.env.CI,
      widenClientFileUpload: true,
      // Hide source maps from browser bundles after upload to Sentry
      hideSourceMaps: true,
      disableLogger: true,
    });
  } catch (e) {
    console.warn("[sentry] @sentry/nextjs not installed yet — skipping wrap");
  }
}

module.exports = exported;
