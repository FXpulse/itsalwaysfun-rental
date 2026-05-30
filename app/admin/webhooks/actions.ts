"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWebhookSecret } from "@/lib/webhooks/dispatch";

const ALLOWED_EVENTS = [
  "booking.created", "booking.confirmed", "booking.cancelled", "booking.paid",
  "customer.created", "quote.sent", "quote.approved", "*",
];

export async function createWebhook(formData: FormData): Promise<
  { ok: true; secret: string } | { error: string }
> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };

  const name = (formData.get("name") || "").toString().trim();
  const url = (formData.get("url") || "").toString().trim();
  if (!name || !url) return { error: "name and url required" };
  if (!/^https:\/\//.test(url)) return { error: "url must be https://" };

  const rawEvents = formData.getAll("event") as string[];
  const events = rawEvents.filter((e) => ALLOWED_EVENTS.includes(e));
  if (events.length === 0) return { error: "select at least one event" };

  const secret = generateWebhookSecret();

  const supabase = createAdminClient();
  const { error } = await supabase.from("tenant_webhooks").insert({
    name, url, events, secret,
    created_by_email: me.email,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/webhooks");
  return { ok: true, secret };
}

export async function toggleWebhook(id: string, active: boolean) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const supabase = createAdminClient();
  const { error } = await supabase.from("tenant_webhooks").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/webhooks");
  return { ok: true };
}

export async function deleteWebhook(id: string) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const supabase = createAdminClient();
  const { error } = await supabase.from("tenant_webhooks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/webhooks");
  return { ok: true };
}

export async function testWebhook(id: string) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const supabase = createAdminClient();
  const { data: hook } = await supabase.from("tenant_webhooks").select("*").eq("id", id).maybeSingle();
  if (!hook) return { error: "webhook not found" };

  const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatch");
  await dispatchWebhookEvent({
    tenant_id: (hook as any).tenant_id,
    event: "booking.created",
    payload: {
      booking_id: "test_00000000",
      customer_email: "test@example.com",
      event_date: new Date().toISOString().slice(0, 10),
      total_cents: 25000,
      _test: true,
    },
  });
  revalidatePath("/admin/webhooks");
  return { ok: true };
}
