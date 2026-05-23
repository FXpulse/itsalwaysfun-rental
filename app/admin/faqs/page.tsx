import { createAdminClient } from "@/lib/supabase/admin";
import { FaqsManager } from "./FaqsManager";

export const dynamic = "force-dynamic";

interface Faq {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

export default async function AdminFaqsPage() {
  const supabase = createAdminClient();
  const { data: faqs } = await supabase
    .from("faqs")
    .select("id, question, answer, display_order, is_active")
    .order("display_order");

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">FAQs</h1>
      <p className="text-sm text-slate-500 mb-6">
        Frequently Asked Questions shown on the public site at <code>/info/faqs</code>.
        Active FAQs are visible; inactive ones are hidden but kept for reference.
      </p>
      <FaqsManager faqs={(faqs as Faq[]) || []} />
    </div>
  );
}
