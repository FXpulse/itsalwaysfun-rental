// Helper to wrap cron handlers with Sentry monitoring checkins.
//
// Pattern (from Sentry's v2 cron monitoring docs):
//   1. Send "in_progress" checkin at start.
//   2. Send "ok" or "error" with the resulting checkin_id at end.
//
// In the Sentry dashboard, configure a Cron Monitor per slug with the
// expected schedule (cron expression matching vercel.json) + tolerance
// window. If a checkin doesn't arrive, Sentry alerts.

import * as Sentry from "@sentry/nextjs";

export interface CronMonitorOptions {
  slug: string;
  /** Cron expression matching vercel.json (e.g. "0 16 * * *") */
  schedule: string;
  /** Minutes after scheduled time before considering a miss */
  checkinMarginMinutes?: number;
  /** Max runtime before considering a hang */
  maxRuntimeMinutes?: number;
}

/** Wrap a cron handler with start/finish checkins. Failures (thrown
 *  exceptions) are reported as 'error' checkins so Sentry can alert. */
export async function withCronMonitor<T>(
  opts: CronMonitorOptions,
  handler: () => Promise<T>,
): Promise<T> {
  const checkinId = Sentry.captureCheckIn(
    {
      monitorSlug: opts.slug,
      status: "in_progress",
    },
    {
      schedule: { type: "crontab", value: opts.schedule },
      checkinMargin: opts.checkinMarginMinutes ?? 5,
      maxRuntime: opts.maxRuntimeMinutes ?? 30,
      timezone: "UTC",
    },
  );

  try {
    const result = await handler();
    Sentry.captureCheckIn({
      checkInId: checkinId,
      monitorSlug: opts.slug,
      status: "ok",
    });
    return result;
  } catch (e) {
    Sentry.captureCheckIn({
      checkInId: checkinId,
      monitorSlug: opts.slug,
      status: "error",
    });
    // Also send the exception so we get the stack trace
    Sentry.captureException(e, { tags: { cron: opts.slug } });
    throw e;
  }
}
