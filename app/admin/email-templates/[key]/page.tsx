import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { ArrowLeft } from "lucide-react";
import { TemplateEditor } from "./TemplateEditor";

export const dynamic = "force-dynamic";

// Sample data used for preview + test sends, per template key.
const SAMPLE_VARS: Record<string, Record<string, string>> = {
  quote_sent: {
    firstName: "Maria",
    quoteNumber: "Q-2026-0001",
    eventDate: "2026-06-15",
    eventEndDate: "2026-06-15",
    totalDollars: "450.00",
    message: "Looking forward to your party — let me know if you need anything!",
    quoteUrl: "https://itsalwaysfun-rental.vercel.app/quotes/sample-token-abc123",
    expiresAtFormatted: "June 29, 2026",
  },
  referral_commission: {
    firstName: "Juan",
    commissionDollars: "45.00",
    referredCustomerEmail: "amigo@ejemplo.com",
    totalPendingDollars: "65.00",
    portalUrl: "https://itsalwaysfun-rental.vercel.app/portal/referrals",
    readyForPayout: "true",
  },
  admin_payout_alert: {
    customerName: "Juan Pérez",
    customerEmail: "juan@ejemplo.com",
    customerPhone: "(904) 555-1234",
    totalPendingDollars: "65.00",
    adminPanelUrl: "https://itsalwaysfun-rental.vercel.app/admin/loyalty/abc123",
  },
  abandoned_cart: {
    firstName: "Maria",
    productName: "All-Star Sports Arena",
    eventDate: "2026-07-04",
    totalDollars: "299.00",
    resumeUrl: "https://itsalwaysfun-rental.vercel.app/order-by-date?product=all-star-sports-arena",
  },
  booking_confirmation: {
    firstName: "Maria",
    lastName: "Lopez",
    productName: "Princess Castle Bouncer",
    eventDate: "06/15/2026",
    eventEndDate: "06/15/2026",
    startTime: "11:00",
    endTime: "17:00",
    address: "123 Main St, Jacksonville, FL 32202",
    totalDollars: "299.00",
    bookingPortalUrl: "https://itsalwaysfun.com/portal/bookings/sample",
  },
  booking_reminder_3d: {
    firstName: "Maria",
    productName: "Princess Castle Bouncer",
    eventDate: "06/15/2026",
    address: "123 Main St, Jacksonville, FL 32202",
    bookingPortalUrl: "https://itsalwaysfun.com/portal/bookings/sample",
  },
};

export default async function EmailTemplateEditorPage({
  params,
}: {
  params: { key: string };
}) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: template } = await supabase
    .from("email_templates")
    .select("*")
    .eq("key", params.key)
    .single();

  if (!template) notFound();

  const sampleVars = SAMPLE_VARS[template.key] || {};

  return (
    <div className="max-w-6xl">
      <Link
        href="/admin/email-templates"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to templates
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1">{template.label}</h1>
      <p className="text-sm text-slate-500 mb-6">{template.description}</p>

      <TemplateEditor
        templateKey={template.key}
        initial={{
          subject: template.subject,
          email_title: template.email_title,
          body_html: template.body_html,
          body_text: template.body_text,
          sms_body: template.sms_body || "",
          is_active: template.is_active,
        }}
        availableVars={template.available_vars || []}
        sampleVars={sampleVars}
        adminEmail={me.email || ""}
      />
    </div>
  );
}
