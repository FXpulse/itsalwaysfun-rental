import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { Gift } from "lucide-react";
import { GiftCardsManager } from "./GiftCardsManager";

export const dynamic = "force-dynamic";

export default async function AdminGiftCardsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: cards } = await supabase
    .from("gift_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const list = (cards as any[]) || [];

  const totalIssued = list.reduce((s, c) => s + c.original_amount_cents, 0);
  const totalOutstanding = list
    .filter((c) => c.is_active)
    .reduce((s, c) => s + c.balance_cents, 0);
  const totalRedeemed = totalIssued - list.reduce((s, c) => s + c.balance_cents, 0);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <Gift className="h-6 w-6" /> Gift cards
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Issue gift cards for customers to give as presents. Recipient gets an
        email with the code; they redeem at checkout.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total issued" value={formatCurrency(totalIssued)} />
        <Stat label="Outstanding balance" value={formatCurrency(totalOutstanding)} accent />
        <Stat label="Redeemed" value={formatCurrency(totalRedeemed)} />
      </div>

      <GiftCardsManager cards={list} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card py-3 ${accent ? "bg-amber-50 border-amber-200" : ""}`}>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold text-brand-navy mt-1">{value}</div>
    </div>
  );
}
