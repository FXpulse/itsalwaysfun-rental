"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { sendTemplated } from "@/lib/email/send-template";
import { isEmailConfigured } from "@/lib/email/send";
import { z } from "zod";

const IssueSchema = z.object({
  amount_dollars: z.number().min(1).max(10000),
  recipient_email: z.string().email(),
  recipient_name: z.string().max(200).optional().nullable(),
  purchaser_name: z.string().max(200).optional().nullable(),
  message: z.string().max(1000).optional().nullable(),
  expires_days: z.number().int().min(0).max(3650).optional(),
});

export async function issueGiftCard(formData: FormData) {
  await requireAdmin();
  const expiresDaysRaw = String(formData.get("expires_days") || "");
  const parsed = IssueSchema.safeParse({
    amount_dollars: parseFloat(String(formData.get("amount_dollars") || "0")),
    recipient_email: String(formData.get("recipient_email") || "").trim().toLowerCase(),
    recipient_name: String(formData.get("recipient_name") || "") || null,
    purchaser_name: String(formData.get("purchaser_name") || "") || null,
    message: String(formData.get("message") || "") || null,
    expires_days: expiresDaysRaw ? parseInt(expiresDaysRaw, 10) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = createAdminClient();
  const { data: codeRow } = await supabase.rpc("generate_gift_card_code");
  const code = codeRow as string;
  if (!code) return { error: "Failed to generate code" };

  const amountCents = Math.round(parsed.data.amount_dollars * 100);
  let expiresAt: string | null = null;
  if (parsed.data.expires_days && parsed.data.expires_days > 0) {
    const d = new Date();
    d.setDate(d.getDate() + parsed.data.expires_days);
    expiresAt = d.toISOString();
  }

  const { data: card, error } = await supabase
    .from("gift_cards")
    .insert({
      code,
      original_amount_cents: amountCents,
      balance_cents: amountCents,
      recipient_email: parsed.data.recipient_email,
      recipient_name: parsed.data.recipient_name,
      purchaser_name: parsed.data.purchaser_name,
      message: parsed.data.message,
      expires_at: expiresAt,
      is_active: true,
    })
    .select("id, code")
    .single();
  if (error) return { error: error.message };

  // Send the card to the recipient via Resend (best-effort)
  if (isEmailConfigured() && card) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
    await sendTemplated({
      key: "gift_card_received",
      to: parsed.data.recipient_email,
      vars: {
        recipientName: parsed.data.recipient_name || "there",
        purchaserName: parsed.data.purchaser_name || "a friend",
        amount: parsed.data.amount_dollars.toFixed(2),
        code: card.code,
        message: parsed.data.message || "",
        bookingUrl: `${baseUrl}/order-by-date`,
        expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString() : "",
      },
      fallback: () => ({
        subject: `🎁 You received a $${parsed.data.amount_dollars.toFixed(2)} gift card!`,
        html: `<p>Hi ${parsed.data.recipient_name || "there"},</p>
<p><strong>${parsed.data.purchaser_name || "Someone"}</strong> sent you a gift card from It's Always Fun for <strong>$${parsed.data.amount_dollars.toFixed(2)}</strong>!</p>
${parsed.data.message ? `<blockquote>"${parsed.data.message}"</blockquote>` : ""}
<p>Your code: <strong style="font-family:monospace;font-size:18px;background:#FFD700;padding:6px 12px;border-radius:4px;">${card.code}</strong></p>
<p>Use it at checkout when you book your rental: <a href="${baseUrl}/order-by-date">${baseUrl}/order-by-date</a></p>
${expiresAt ? `<p>Expires: ${new Date(expiresAt).toLocaleDateString()}</p>` : ""}
<p>— The It's Always Fun team</p>`,
        text: `You received a $${parsed.data.amount_dollars.toFixed(2)} gift card from It's Always Fun!\nCode: ${card.code}\nUse it at ${baseUrl}/order-by-date`,
      }),
      tags: [{ name: "type", value: "gift_card_received" }],
    });

    await supabase
      .from("gift_cards")
      .update({ sent_to_recipient_at: new Date().toISOString() })
      .eq("id", card.id);
  }

  revalidatePath("/admin/gift-cards");
  return { success: true, code };
}

export async function deactivateGiftCard(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("gift_cards")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/gift-cards");
  return { success: true };
}

/** Toggle whether customers can buy gift cards from /gift-cards.
 *  Stored in site_settings.gift_card_sales_enabled ("true"/"false").
 *  Default = enabled when key missing. */
export async function setGiftCardSalesEnabled(enabled: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { key: "gift_card_sales_enabled", value: enabled ? "true" : "false" },
      { onConflict: "key" },
    );
  if (error) return { error: error.message };
  revalidatePath("/admin/gift-cards");
  revalidatePath("/gift-cards");
  return { success: true };
}
