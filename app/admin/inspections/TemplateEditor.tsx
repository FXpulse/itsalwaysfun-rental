"use client";

// Editor reutilizable para create (new) y update ([id]).
// Permite definir nombre, scope (product/category/global), y la lista de items
// del checklist (key auto-slug del label, label editable).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTemplate, updateTemplate, deleteTemplate } from "./actions";

interface ItemRow {
  key: string;
  label: string;
}

interface Product { id: string; name: string }
interface Category { id: string; name: string }

interface Props {
  templateId?: string;
  initial?: {
    name: string;
    product_id: string | null;
    category_id: string | null;
    items: ItemRow[];
    is_active: boolean;
  };
  products: Product[];
  categories: Category[];
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const STARTER_ITEMS: ItemRow[] = [
  { key: "blower", label: "Blower funciona / works" },
  { key: "stakes", label: "Anchors/stakes presentes" },
  { key: "rips", label: "Sin rips ni tears" },
  { key: "clean", label: "Limpio / clean" },
  { key: "manual", label: "Manual entregado al cliente" },
];

export function TemplateEditor({ templateId, initial, products, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name || "");
  const [scope, setScope] = useState<"global" | "product" | "category">(
    initial?.product_id ? "product" : initial?.category_id ? "category" : "global"
  );
  const [productId, setProductId] = useState(initial?.product_id || "");
  const [categoryId, setCategoryId] = useState(initial?.category_id || "");
  const [items, setItems] = useState<ItemRow[]>(initial?.items?.length ? initial.items : STARTER_ITEMS);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { key: `item_${prev.length + 1}`, label: "" }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function moveItem(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleSubmit() {
    if (name.trim().length < 2) {
      toast.error("Name is required");
      return;
    }
    const cleanItems = items
      .filter((it) => it.label.trim().length > 0)
      .map((it) => ({ key: it.key || slugify(it.label), label: it.label.trim() }));
    if (cleanItems.length < 1) {
      toast.error("Add at least one checklist item");
      return;
    }
    // Dedupe keys to avoid silent overwrites at runtime
    const seen = new Set<string>();
    for (const it of cleanItems) {
      if (seen.has(it.key)) {
        toast.error(`Duplicate item key "${it.key}" — make labels unique`);
        return;
      }
      seen.add(it.key);
    }

    startTransition(async () => {
      const input = {
        name: name.trim(),
        product_id: scope === "product" ? productId || null : null,
        category_id: scope === "category" ? categoryId || null : null,
        items: cleanItems,
        is_active: isActive,
      };
      const r = templateId
        ? await updateTemplate(templateId, input)
        : await createTemplate(input);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(templateId ? "Template updated" : "Template created");
      router.push("/admin/inspections");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!templateId) return;
    if (!confirm("Archive this template? Existing inspection records keep their snapshots.")) return;
    startTransition(async () => {
      const r = await deleteTemplate(templateId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Template archived");
      router.push("/admin/inspections");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bouncer delivery checklist"
            className="w-full rounded border border-slate-300 px-3 py-2"
            maxLength={120}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Scope</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                checked={scope === "global"}
                onChange={() => setScope("global")}
              />
              Global (all products)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                checked={scope === "category"}
                onChange={() => setScope("category")}
              />
              Per category
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                checked={scope === "product"}
                onChange={() => setScope("product")}
              />
              Specific product
            </label>
          </div>
          {scope === "category" && (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-2 rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— pick category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {scope === "product" && (
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-2 rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— pick product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Most specific match wins when suggesting a template on a booking
            (product → category → global).
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (uncheck to archive — historical records keep their snapshots)
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800">Checklist items ({items.length})</h2>
          <button
            type="button"
            onClick={addItem}
            className="text-sm rounded-md bg-slate-100 hover:bg-slate-200 px-3 py-1.5"
          >
            + Add item
          </button>
        </div>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  title="Move up"
                >▲</button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  title="Move down"
                >▼</button>
              </div>
              <input
                type="text"
                value={it.label}
                onChange={(e) => {
                  const newLabel = e.target.value;
                  updateItem(idx, {
                    label: newLabel,
                    key: it.key && it.key !== `item_${idx + 1}` ? it.key : slugify(newLabel),
                  });
                }}
                placeholder="Blower works"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                maxLength={200}
              />
              <input
                type="text"
                value={it.key}
                onChange={(e) => updateItem(idx, { key: slugify(e.target.value) })}
                placeholder="auto-slug"
                className="w-32 rounded border border-slate-200 px-3 py-2 text-xs text-slate-500"
                maxLength={40}
                title="Internal key (lowercase, no spaces) — auto-generated from label"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-red-500 hover:bg-red-50 rounded px-2"
                title="Remove"
              >✕</button>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Tip: keep items binary (yes/no). At inspection time the driver marks each one as pass / fail and can attach a photo or note per item.
        </p>
      </div>

      <div className="flex gap-3 items-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-md bg-brand-navy text-white px-5 py-2 font-medium hover:bg-brand-navy-dark disabled:opacity-50"
        >
          {pending ? "Saving..." : templateId ? "Save template" : "Create template"}
        </button>
        {templateId && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-md border border-red-300 text-red-700 px-4 py-2 font-medium hover:bg-red-50 disabled:opacity-50"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}
