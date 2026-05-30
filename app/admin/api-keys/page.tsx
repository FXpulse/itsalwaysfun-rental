import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { Key, Sparkles, BookOpen } from "lucide-react";
import { ApiKeysClient } from "./ApiKeysClient";

export const dynamic = "force-dynamic";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  last_used_ip: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by_email: string | null;
}

export default async function AdminApiKeysPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: keys } = await supabase
    .from("tenant_api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  const list: ApiKey[] = (keys as ApiKey[]) || [];
  const active = list.filter((k) => !k.revoked_at);
  const revoked = list.filter((k) => k.revoked_at);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-100 mb-2">
          <Key className="h-3 w-3" /> API Keys
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7" /> Connect anything to RentalFlow
        </h1>
        <p className="text-sm text-indigo-100 mt-1">
          Generate API keys to integrate your bookings with Zapier, Make, your accounting system, or a custom app.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-[10px] uppercase text-indigo-200">Active keys</div>
            <div className="text-2xl font-bold mt-1">{active.length}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-[10px] uppercase text-indigo-200">Revoked</div>
            <div className="text-2xl font-bold mt-1">{revoked.length}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-[10px] uppercase text-indigo-200">Recently used</div>
            <div className="text-2xl font-bold mt-1">
              {active.filter((k) => k.last_used_at && (Date.now() - new Date(k.last_used_at).getTime()) < 7 * 86_400_000).length}
            </div>
          </div>
        </div>
      </div>

      {/* Docs callout */}
      <div className="card bg-gradient-to-br from-slate-50 to-blue-50 ring-1 ring-blue-200 p-5">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-blue-600" /> Quick start
        </h2>
        <pre className="bg-slate-900 text-emerald-300 text-xs p-3 rounded-lg overflow-x-auto">
{`curl https://getrentalflow.com/api/v1/bookings \\
  -H "Authorization: Bearer rfk_..."`}
        </pre>
        <p className="text-xs text-slate-600 mt-2">
          Available endpoints: <code className="bg-slate-100 px-1 rounded">/api/v1/bookings</code>,{" "}
          <code className="bg-slate-100 px-1 rounded">/api/v1/customers</code>,{" "}
          <code className="bg-slate-100 px-1 rounded">/api/v1/products</code>
        </p>
      </div>

      <ApiKeysClient keys={list} />
    </div>
  );
}
