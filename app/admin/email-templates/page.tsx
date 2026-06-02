import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getTenantInfo } from "@/lib/tenant/business";
import { formatDateTimeInTz } from "@/lib/tenant/timezone";
import { Mail, ArrowRight, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminEmailTemplatesPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const { data: templates } = await supabase
    .from("email_templates")
    .select("key, label, description, is_active, updated_at")
    .order("key", { ascending: true });

  const emailConfigured = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Email Templates</h1>
      <p className="text-sm text-slate-500 mb-6">
        Edit subject + body for each automated email. Use {`{{variableName}}`} for
        substitutions and {`{{#if varName}}...{{/if}}`} for conditional blocks.
      </p>

      {!emailConfigured && (
        <div className="card bg-amber-50 border-amber-200 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h2 className="font-semibold text-amber-900">Email delivery not enabled</h2>
              <p className="text-sm text-amber-800">
                Templates are editable but won't send. Contact RentalFlow
                support to enable email delivery for your account.
              </p>
            </div>
          </div>
        </div>
      )}

      {!templates || templates.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No templates yet. Run <code>supabase/email_templates.sql</code> to seed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t: any) => (
            <Link
              key={t.key}
              href={`/admin/email-templates/${t.key}`}
              className={`card flex items-center justify-between hover:shadow-md transition ${!t.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-brand-navy" />
                  <h2 className="font-semibold text-brand-navy">{t.label}</h2>
                  {!t.is_active && (
                    <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-2 py-0.5">
                      DISABLED
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{t.description || "—"}</p>
                <div className="text-xs text-slate-400 mt-1">
                  Key: <code>{t.key}</code> · Last edit{" "}
                  {formatDateTimeInTz(t.updated_at, tz)}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
