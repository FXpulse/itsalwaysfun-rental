// /superadmin/* — SaaS owner view, independent of any tenant.
// Auth check is per-page (not in layout) so /superadmin/login can render
// without requiring auth.
//
// Defense in depth: middleware redirects tenant hosts to the apex, but
// we ALSO read x-tenant-via here. If middleware fails open (network blip,
// downstream rewrite), we still don't render /superadmin from a tenant.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AssistantBubble } from "./AssistantBubble";
import { RealtimeNotifications } from "./RealtimeNotifications";

export const dynamic = "force-dynamic";

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const via = headers().get("x-tenant-via");
  // Only the marketing apex hosts /superadmin/*. Tenant subdomains and
  // custom domains get bounced. This is belt-and-suspenders — middleware
  // handles it in production, this catches the leak if middleware is
  // misconfigured or bypassed.
  if (via && via !== "marketing") {
    redirect("https://getrentalflow.com/superadmin/login");
  }

  return (
    <>
      {children}
      <AssistantBubble />
      <RealtimeNotifications />
    </>
  );
}
