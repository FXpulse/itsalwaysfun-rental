/**
 * Cloudflare Email Worker — forwards emails sent to bookings@itsalwaysfun.com
 * into /admin/inbox of the rental app.
 *
 * SETUP (one time):
 *   1. Cloudflare dashboard → Email → Email Routing → enable for your domain
 *      (this adds the required MX records automatically).
 *   2. Workers & Pages → Create application → Create Worker.
 *      Paste this file's contents as the Worker code.
 *   3. Worker settings → Variables and Secrets → add:
 *        INBOX_WEBHOOK_URL = https://itsalwaysfun-rental.vercel.app/api/email/inbound
 *        INBOX_SECRET = <a random string, e.g. generate with `openssl rand -hex 32`>
 *   4. In Vercel → Project settings → Environment Variables → add:
 *        INBOUND_EMAIL_SECRET = <THE SAME random string>
 *      Redeploy the Vercel project.
 *   5. Cloudflare Email → Email Routing → Routes → "Custom addresses" →
 *      Add: bookings@itsalwaysfun.com → Send to Worker → pick this Worker.
 *   6. Send a test email from your Gmail to bookings@itsalwaysfun.com.
 *      It should appear in /admin/inbox within ~30 seconds.
 *
 * WHY THIS WORKER (vs simple Email Routing forward)?
 *   - Routes the email into your admin inbox UI so all messages live in one place
 *   - Captures sender, subject, full body — replies thread to that message
 *   - Survives even if the customer sends from an address you haven't seen before
 */

import PostalMime from "postal-mime";

export default {
  async email(message, env, ctx) {
    if (!env.INBOX_WEBHOOK_URL || !env.INBOX_SECRET) {
      console.error("Worker not configured: missing INBOX_WEBHOOK_URL or INBOX_SECRET");
      // Don't reject — that bounces the email. Just log + drop.
      return;
    }

    let parsed;
    try {
      const parser = new PostalMime();
      parsed = await parser.parse(message.raw);
    } catch (e) {
      console.error("Failed to parse email", e);
      return;
    }

    const fromAddr = parsed.from?.address || message.from;
    const fromName = parsed.from?.name || "";
    const subject = parsed.subject || "(no subject)";
    const text = parsed.text || "";
    const html = parsed.html || "";

    if (!fromAddr) {
      console.error("No sender address — skipping");
      return;
    }

    try {
      const res = await fetch(env.INBOX_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-inbound-secret": env.INBOX_SECRET,
        },
        body: JSON.stringify({
          from: fromAddr,
          from_name: fromName,
          to: message.to,
          subject,
          text,
          html,
          received_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Webhook failed: ${res.status} ${errText}`);
      } else {
        console.log(`Email from ${fromAddr} forwarded to inbox`);
      }
    } catch (e) {
      console.error("Webhook request failed", e);
    }
  },
};
