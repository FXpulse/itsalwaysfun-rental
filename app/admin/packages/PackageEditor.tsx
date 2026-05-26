"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft, Save, Upload } from "lucide-react";
import { createPackage, updatePackage, deletePackage } from "./actions";
import { uploadPackageImage } from "../site/actions";
import { formatCurrency } from "@/lib/utils";

interface ProductOption {
  id: string;
  name: string;
  slug: string;
  price_per_day: number;
}

interface BundleItem {
  product_id: string;
  quantity: number;
  name: string;
}

export interface PackageData {
  id?: string;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  price_cents: number;
  items: BundleItem[];
  display_order: number;
  is_active: boolean;
}

export function PackageEditor({
  initial,
  products,
}: {
  initial?: PackageData;
  products: ProductOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [data, setData] = useState<PackageData>(
    initial || {
      slug: "",
      name: "",
      description: "",
      image_url: "",
      price_cents: 0,
      items: [],
      display_order: 0,
      is_active: true,
    },
  );

  function patch(p: Partial<PackageData>) {
    setData((d) => ({ ...d, ...p }));
  }

  function addItem(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setData((d) => ({
      ...d,
      items: [
        ...d.items,
        { product_id: p.id, quantity: 1, name: p.name },
      ],
    }));
  }

  function updateItem(idx: number, p: Partial<BundleItem>) {
    setData((d) => ({
      ...d,
      items: d.items.map((it, i) => (i === idx ? { ...it, ...p } : it)),
    }));
  }

  function removeItem(idx: number) {
    setData((d) => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));
  }

  // Compute "regular" price if each item was rented individually
  const regularPrice = data.items.reduce((sum, it) => {
    const p = products.find((x) => x.id === it.product_id);
    if (!p) return sum;
    return sum + p.price_per_day * it.quantity;
  }, 0);

  const savings = regularPrice - data.price_cents;
  const savingsPct = regularPrice > 0 ? (savings / regularPrice) * 100 : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (data.items.length === 0) {
      toast.error("Bundle needs at least 1 item");
      return;
    }
    const fd = new FormData();
    fd.append("slug", data.slug);
    fd.append("name", data.name);
    fd.append("description", data.description);
    fd.append("image_url", data.image_url);
    fd.append("price_dollars", String(data.price_cents / 100));
    fd.append("items", JSON.stringify(data.items));
    fd.append("display_order", String(data.display_order));
    if (data.is_active) fd.append("is_active", "on");

    startTransition(async () => {
      const r = data.id
        ? await updatePackage(data.id, fd)
        : await createPackage(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(data.id ? "Package updated" : "Package created");
      router.push("/admin/packages");
    });
  }

  function handleDelete() {
    if (!data.id) return;
    if (!confirm(`Delete package "${data.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deletePackage(data.id!);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      router.push("/admin/packages");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      <Link
        href="/admin/packages"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Back to packages
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy">
        {data.id ? "Edit package" : "New package"}
      </h1>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Basics</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" required>
            <input
              required
              className="input"
              value={data.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Big Birthday Bundle"
            />
          </Field>
          <Field label="Slug (URL-safe)" required>
            <input
              required
              className="input font-mono"
              value={data.slug}
              onChange={(e) => patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
              placeholder="big-birthday-bundle"
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            rows={2}
            className="input"
            value={data.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Perfect for kids parties — includes everything you need"
          />
        </Field>
        <Field label="Image (cover for /packages page)">
          <PackageImageField
            value={data.image_url}
            onChange={(url) => patch({ image_url: url })}
            slug={data.slug}
          />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Items in bundle</h2>
        <select
          className="input"
          value=""
          onChange={(e) => {
            if (e.target.value) addItem(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">+ Add product to bundle...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatCurrency(p.price_per_day)}/day
            </option>
          ))}
        </select>

        {data.items.length === 0 ? (
          <div className="text-center text-slate-400 py-4 text-sm border-2 border-dashed border-slate-200 rounded">
            No items yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left py-2">Item</th>
                <th className="text-center py-2 w-20">Qty</th>
                <th className="text-right py-2 w-28">Individual</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((it, i) => {
                const product = products.find((p) => p.id === it.product_id);
                const indiv = product ? product.price_per_day * it.quantity : 0;
                return (
                  <tr key={i}>
                    <td className="py-2 font-medium">{it.name}</td>
                    <td className="py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(i, { quantity: parseInt(e.target.value) || 1 })
                        }
                        className="input text-center w-16"
                      />
                    </td>
                    <td className="py-2 text-right font-mono text-slate-600">
                      {formatCurrency(indiv)}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Pricing</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bundle price (USD)" required>
            <input
              type="number"
              min={0}
              step="0.01"
              required
              className="input text-lg font-bold"
              value={(data.price_cents / 100).toFixed(2)}
              onChange={(e) =>
                patch({
                  price_cents: Math.round(parseFloat(e.target.value || "0") * 100),
                })
              }
            />
          </Field>
          <div className="text-sm">
            <div className="text-xs text-slate-500 mb-1">Comparison</div>
            <div className="text-slate-700">
              Items individually: <strong>{formatCurrency(regularPrice)}</strong>
            </div>
            {savings > 0 && data.price_cents > 0 && (
              <div className="text-green-700 font-semibold">
                Customer saves {formatCurrency(savings)} ({savingsPct.toFixed(0)}% off)
              </div>
            )}
            {savings < 0 && data.price_cents > 0 && (
              <div className="text-amber-700 text-xs">
                ⚠ Bundle costs MORE than items individually. Make sure that's intentional.
              </div>
            )}
          </div>
        </div>
        <Field label="Display order (lower = first)">
          <input
            type="number"
            className="input max-w-[100px]"
            value={data.display_order}
            onChange={(e) => patch({ display_order: parseInt(e.target.value) || 0 })}
          />
        </Field>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.is_active}
            onChange={(e) => patch({ is_active: e.target.checked })}
            className="h-4 w-4"
          />
          Active (visible on public site)
        </label>
      </section>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
          <Save className="h-4 w-4" />
          {pending ? "Saving..." : data.id ? "Save changes" : "Create package"}
        </button>
        {data.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-sm text-red-600 hover:text-red-800 px-3 py-2 inline-flex items-center gap-1"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function PackageImageField({
  value,
  onChange,
  slug,
}: {
  value: string;
  onChange: (url: string) => void;
  slug: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    fd.append("filename_hint", slug || "package");
    const r = await uploadPackageImage(fd);
    setUploading(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    onChange(r.url);
    toast.success("Image uploaded");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... or upload →"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Package preview"
          className="h-32 w-32 object-cover rounded border border-slate-200"
        />
      )}
    </div>
  );
}
