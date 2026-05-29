// Edge runtime Sentry init (middleware, edge API routes). Loaded automatically.

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry/scrub-pii";

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    sampleRate: 1.0,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    debug: false,
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryEvent(breadcrumb);
    },
  });
}
