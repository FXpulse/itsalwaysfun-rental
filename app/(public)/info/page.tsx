import Link from "next/link";
import { HelpCircle, Shield, FileText, Scale, BookOpen, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/info/faqs",
    label: "FAQs",
    description: "Common questions about deliveries, payments, weather, safety, and more.",
    icon: HelpCircle,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    href: "/info/policies",
    label: "Policies",
    description: "Delivery, cancellation, refund, and rental policies.",
    icon: BookOpen,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    href: "/info/waiver",
    label: "Liability Waiver",
    description: "Customer agreement signed before delivery.",
    icon: FileText,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    href: "/info/privacy-policy",
    label: "Privacy Policy",
    description: "How we collect, use, and protect your personal information.",
    icon: Shield,
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    href: "/info/terms-of-service",
    label: "Terms of Service",
    description: "The agreement that governs your use of this site and our services.",
    icon: Scale,
    color: "bg-slate-50 text-slate-700 border-slate-200",
  },
];

export default function InfoIndexPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-2">
          Information & Policies
        </h1>
        <p className="text-sm text-slate-500">
          Everything you need to know before booking your rental.
        </p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-4 p-5 rounded-xl border-2 border-slate-200 hover:border-brand-yellow hover:shadow-md transition bg-white"
            >
              <div className={`shrink-0 w-12 h-12 rounded-lg border ${s.color} flex items-center justify-center`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-brand-navy text-lg group-hover:underline">
                  {s.label}
                </h2>
                <p className="text-sm text-slate-600 mt-1">{s.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-brand-navy shrink-0 mt-2" />
            </Link>
          );
        })}
      </div>

      <div className="mt-10 bg-slate-50 border border-slate-200 rounded-lg p-5 text-center">
        <p className="text-sm text-slate-600">
          Have another question? Use our chat in the corner or contact us directly.
        </p>
      </div>
    </div>
  );
}
