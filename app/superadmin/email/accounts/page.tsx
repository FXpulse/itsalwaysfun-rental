import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Crumbs } from "../../Crumbs";
import { SyncNowButton } from "./SyncNowButton";
import type { EmailAccount } from "@/lib/email/types";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");

  const supabase = createAdminClient({ unscoped: true });
  const { data: accounts } = await supabase
    .from("email_accounts").select("*").order("created_at");

  const list = (accounts as EmailAccount[]) || [];

  return (
    <div className="max-w-4xl">
      <Crumbs trail={[{ label: "Email", href: "/superadmin/email" }, { label: "Accounts" }]} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Mail className="h-6 w-6" /> Email accounts
        </h1>
        <div className="flex items-center gap-2">
          <SyncNowButton />
          <Link href="/superadmin/email/accounts/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add account
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500 card">
          No email accounts yet. Add your first to start syncing.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-brand-navy flex items-center gap-2">
                    {a.is_active && !a.last_sync_error ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    {a.email_address}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Brand: <strong>{a.brand}</strong> · Label: {a.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    IMAP {a.imap_host}:{a.imap_port} · SMTP {a.smtp_host}:{a.smtp_port}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {a.last_sync_at ? (
                    <>Last sync: {new Date(a.last_sync_at).toLocaleString()}</>
                  ) : (
                    <>Never synced</>
                  )}
                  {a.last_sync_error && (
                    <details className="text-red-600 mt-1 max-w-md">
                      <summary className="cursor-pointer">Error: {a.last_sync_error.slice(0, 60)}…</summary>
                      <pre className="text-[10px] whitespace-pre-wrap mt-1 font-mono bg-red-50 p-2 rounded">
                        {a.last_sync_error}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
