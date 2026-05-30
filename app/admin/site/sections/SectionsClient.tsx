"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Eye, EyeOff } from "lucide-react";
import type { SectionDef } from "@/lib/admin/home-sections";
import { upsertSection } from "./actions";

interface SectionState {
  def: SectionDef;
  id: string | null;
  is_enabled: boolean;
  display_order: number;
  content: Record<string, string>;
}

export function SectionsClient({ sections }: { sections: SectionState[] }) {
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <SectionEditor key={s.def.type} initial={s} />
      ))}
    </div>
  );
}

function SectionEditor({ initial }: { initial: SectionState }) {
  const [enabled, setEnabled] = useState(initial.is_enabled);
  const [content, setContent] = useState<Record<string, string>>(initial.content);
  const [order, setOrder] = useState(initial.display_order);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const r = await upsertSection({
        section_type: initial.def.type,
        is_enabled: enabled,
        display_order: order,
        content,
      });
      if ("error" in r) toast.error(r.error);
      else toast.success(`${initial.def.title} saved`);
    });
  }

  return (
    <div className={`card transition ${enabled ? "ring-2 ring-emerald-300" : "opacity-75"}`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-3">
            <div className="text-2xl">{initial.def.emoji}</div>
            <div>
              <h3 className="font-bold text-brand-navy text-base">{initial.def.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{initial.def.description}</p>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${enabled ? "text-emerald-700" : "text-slate-400"}`}>
              {enabled ? <><Eye className="inline h-3 w-3 mr-1" />Shown</> : <><EyeOff className="inline h-3 w-3 mr-1" />Hidden</>}
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-5 w-5"
            />
          </label>
        </div>

        {/* Fields — only show if enabled */}
        {enabled && (
          <>
            <div className="space-y-3 mt-4">
              {initial.def.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={content[f.key] || ""}
                      onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      rows={3}
                      className="input"
                    />
                  ) : f.type === "html" ? (
                    <textarea
                      value={content[f.key] || ""}
                      onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      rows={8}
                      className="input font-mono text-xs"
                    />
                  ) : (
                    <input
                      type={f.type === "url" ? "url" : "text"}
                      value={content[f.key] || ""}
                      onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="input"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <label className="text-xs">
                <span className="text-slate-500">Display order</span>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
                  className="input w-20 ml-2 inline-block"
                  title="Lower = higher on the page"
                />
              </label>
              <span className="text-[10px] text-slate-400">Lower number = appears higher on the page</span>
            </div>
          </>
        )}

        <div className="mt-4">
          <button
            onClick={save}
            disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1"
          >
            <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
