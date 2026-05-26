// Browser-side Sentry init. Loaded automatically by @sentry/nextjs.
// Captures: unhandled exceptions, unhandled rejections, console.error,
// React error boundaries, network errors.

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // Adjust this in production based on traffic volume.
    // 1.0 = capture 100% of transactions for performance monitoring.
    // 0.1 = 10% sample (recommended for high-traffic apps).
    tracesSampleRate: 0.1,
    // Capture 100% of unhandled errors regardless of sample rate.
    sampleRate: 1.0,
    // Environment tag so we can filter prod vs preview vs dev in the Sentry UI.
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
    // Show user-friendly debug info in dev only.
    debug: false,
    // Don't send PII by default — Sentry can scrub but we don't need raw user emails in error reports.
    sendDefaultPii: false,
    // Ignore noisy errors we can't act on
    ignoreErrors: [
      // Browser extensions
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      // Network blips that auto-recover
      "Failed to fetch",
      "Load failed",
      // Stripe sometimes throws benign aborts
      "AbortError",
    ],
  });
}
