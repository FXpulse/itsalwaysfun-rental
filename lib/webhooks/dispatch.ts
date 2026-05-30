// Webhook dispatcher. Call dispatchWebhookEvent() from any place that
// emits an event; it fans out to all subscribed tenant_webhooks for that
// tenant + event, fire-and-forget.
//
// HMAC signature: sha256(secret + JSON payload), sent as X-RentalFlow-Signature.
// Receivers can verify by computing the same hash.

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookEvent =
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.paid"
  | "customer.created"
  | "quote.sent"
  | "quote.approved";

interface DispatchInput {
  tenant_id: string;
  event: WebhookEvent;
  payload: Record<string, any>;
}

/**
 * Fire webhook deliveries for all matching subscriptions. Returns
 * immediately — actual HTTP calls happen in background.
 */
export async function dispatchWebhookEvent(input: DispatchInput): Promise<void> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: hooks } = await supabase
    .from("tenant_webhooks")
    .select("id, url, secret, events")
    .eq("tenant_id", input.tenant_id)
    .eq("is_active", true);

  const matching = ((hooks as any[]) || []).filter((h) =>
    Array.isArray(h.events) && (h.events.includes(input.event) || h.events.includes("*")),
  );

  // Fire-and-forget so we don't block whatever triggered the event.
  for (const h of matching) {
    deliver(h, input).catch((e) => console.error("[webhook deliver failed]", e?.message));
  }
}

// Exponential backoff schedule per attempt number.
// attempt 1 = immediate (real-time), then retries at +5m, +30m, +2h, then give up.
const RETRY_DELAYS_MS = [0, 5 * 60_000, 30 * 60_000, 2 * 3_600_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

export function nextRetryAt(attemptNumber: number): Date | null {
  if (attemptNumber >= MAX_ATTEMPTS) return null;
  return new Date(Date.now() + RETRY_DELAYS_MS[attemptNumber]);
}

async function deliver(
  hook: { id: string; url: string; secret: string },
  input: DispatchInput,
  existingDeliveryId?: string,
  attemptCount: number = 1,
): Promise<void> {
  const supabase = createAdminClient({ unscoped: true });
  const body = {
    event: input.event,
    tenant_id: input.tenant_id,
    timestamp: new Date().toISOString(),
    data: input.payload,
  };
  const bodyJson = JSON.stringify(body);
  const sig = createHmac("sha256", hook.secret).update(bodyJson).digest("hex");

  let status = 0;
  let respText = "";
  let succeeded = false;
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RentalFlow-Event": input.event,
        "X-RentalFlow-Signature": `sha256=${sig}`,
        "X-RentalFlow-Attempt": String(attemptCount),
        "User-Agent": "RentalFlow-Webhooks/1.0",
      },
      body: bodyJson,
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    respText = (await res.text()).slice(0, 1000);
    succeeded = res.ok;
  } catch (e: any) {
    status = 0;
    respText = `request_failed: ${e?.message || e}`;
  }

  // Schedule a retry on failure if attempts remain
  const next = succeeded ? null : nextRetryAt(attemptCount);

  if (existingDeliveryId) {
    // Update existing delivery row (retry path)
    await supabase.from("webhook_deliveries").update({
      response_status: status,
      response_body: respText,
      succeeded,
      attempt_count: attemptCount,
      next_retry_at: next ? next.toISOString() : null,
    }).eq("id", existingDeliveryId);
  } else {
    // First attempt — insert new row
    await supabase.from("webhook_deliveries").insert({
      webhook_id: hook.id,
      event: input.event,
      payload: body,
      response_status: status,
      response_body: respText,
      succeeded,
      attempt_count: attemptCount,
      next_retry_at: next ? next.toISOString() : null,
      max_attempts: MAX_ATTEMPTS,
    });
  }

  await supabase.from("tenant_webhooks")
    .update({
      last_delivery_at: new Date().toISOString(),
      last_delivery_status: status,
    })
    .eq("id", hook.id);
}

/**
 * Re-attempt a previously-failed delivery. Used by the retry cron.
 */
export async function retryDelivery(deliveryId: string): Promise<void> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, event, payload, attempt_count")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) return;
  const { data: hook } = await supabase
    .from("tenant_webhooks")
    .select("id, url, secret, is_active")
    .eq("id", (delivery as any).webhook_id)
    .maybeSingle();
  if (!hook || !(hook as any).is_active) return;

  const payload = (delivery as any).payload || {};
  await deliver(
    { id: (hook as any).id, url: (hook as any).url, secret: (hook as any).secret },
    {
      tenant_id: payload.tenant_id,
      event: payload.event,
      payload: payload.data || {},
    },
    deliveryId,
    ((delivery as any).attempt_count || 0) + 1,
  );
}

export function generateWebhookSecret(): string {
  // 32 bytes → 43 base64url chars, prefixed for clarity
  const random = require("crypto").randomBytes(32).toString("base64url");
  return `whsec_${random}`;
}
