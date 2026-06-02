import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { Webhook, Sparkles, Code } from "lucide-react";
import { WebhooksClient } from "./WebhooksClient";
import { getTenantInfo } from "@/lib/tenant/business";

export const dynamic = "force-dynamic";

interface Hook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_delivery_status: number | null;
  total_deliveries: number;
  failed_deliveries: number;
  created_at: string;
}

export default async function AdminWebhooksPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/login");

  const supabase = createAdminClient();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const { data: hooks } = await supabase
    .from("tenant_webhooks")
    .select("*")
    .order("created_at", { ascending: false });

  const list: Hook[] = (hooks as Hook[]) || [];
  const active = list.filter((h) => h.is_active).length;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-violet-100 mb-2">
          <Webhook className="h-3 w-3" /> Webhooks
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7" /> Real-time event subscriptions
        </h1>
        <p className="text-sm text-violet-100 mt-1">
          Get an HTTP POST every time something happens in your business — perfect for Zapier, Make, custom integrations.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-[10px] uppercase text-violet-200">Active</div>
            <div className="text-2xl font-bold mt-1">{active}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-[10px] uppercase text-violet-200">Total deliveries</div>
            <div className="text-2xl font-bold mt-1">
              {list.reduce((sum, h) => sum + (h.total_deliveries || 0), 0)}
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-[10px] uppercase text-violet-200">Failed</div>
            <div className="text-2xl font-bold mt-1">
              {list.reduce((sum, h) => sum + (h.failed_deliveries || 0), 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Event docs */}
      <div className="card bg-gradient-to-br from-slate-50 to-violet-50 ring-1 ring-violet-200 p-5">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
          <Code className="h-4 w-4 text-violet-600" /> Available events
        </h2>
        <ul className="grid sm:grid-cols-2 gap-1 text-xs">
          <li><code className="bg-slate-100 px-1 rounded">booking.created</code> — new booking</li>
          <li><code className="bg-slate-100 px-1 rounded">booking.confirmed</code> — payment received</li>
          <li><code className="bg-slate-100 px-1 rounded">booking.cancelled</code> — booking cancelled</li>
          <li><code className="bg-slate-100 px-1 rounded">booking.paid</code> — fully paid</li>
          <li><code className="bg-slate-100 px-1 rounded">customer.created</code> — new customer</li>
          <li><code className="bg-slate-100 px-1 rounded">quote.sent</code> — quote sent to customer</li>
          <li><code className="bg-slate-100 px-1 rounded">quote.approved</code> — customer approved</li>
          <li><code className="bg-slate-100 px-1 rounded">*</code> — subscribe to ALL</li>
        </ul>
        <div className="mt-3 text-xs text-slate-600">
          <strong>Signature verification:</strong> Every POST includes header{" "}
          <code className="bg-slate-100 px-1 rounded">X-RentalFlow-Signature: sha256=&lt;hex&gt;</code>.
          Compute <code>HMAC-SHA256(secret, body)</code> and compare to verify the request came from us.
        </div>
      </div>

      <WebhooksClient hooks={list} tz={tz} />
    </div>
  );
}
