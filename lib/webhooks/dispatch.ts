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

async function deliver(
  hook: { id: string; url: string; secret: string },
  input: DispatchInput,
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
        "User-Agent": "RentalFlow-Webhooks/1.0",
      },
      body: bodyJson,
      // 10s timeout — abort if receiver is slow
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    respText = (await res.text()).slice(0, 1000);
    succeeded = res.ok;
  } catch (e: any) {
    status = 0;
    respText = `request_failed: ${e?.message || e}`;
  }

  // Log delivery + update hook stats (best effort, don't fail caller)
  await Promise.allSettled([
    supabase.from("webhook_deliveries").insert({
      webhook_id: hook.id,
      event: input.event,
      payload: body,
      response_status: status,
      response_body: respText,
      succeeded,
    }),
    supabase.from("tenant_webhooks")
      .update({
        last_delivery_at: new Date().toISOString(),
        last_delivery_status: status,
        total_deliveries: 1 as any, // increment via RPC ideally; for MVP we just stamp last
      })
      .eq("id", hook.id),
  ]);
}

export function generateWebhookSecret(): string {
  // 32 bytes → 43 base64url chars, prefixed for clarity
  const random = require("crypto").randomBytes(32).toString("base64url");
  return `whsec_${random}`;
}
