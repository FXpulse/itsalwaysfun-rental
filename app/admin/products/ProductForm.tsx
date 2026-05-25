"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Product } from "@/types/database";

interface Props {
  product?: Product | null;
  action: (formData: FormData) => Promise<{ error?: any; success?: boolean } | void>;
  submitLabel?: string;
  categories?: { name: string }[];
}

const FALLBACK_CATEGORIES = [
  "Bounce Houses",
  "Bounce & Slide Combos",
  "Dry Slides",
  "Concessions",
  "Add-Ons",
];

export function ProductForm({ product, action, submitLabel = "Save", categories }: Props) {
  const categoryOptions =
    categories && categories.length > 0
      ? categories.map((c) => c.name)
      : FALLBACK_CATEGORIES;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      setErrors({});
      const result = await action(formData);
      if (result && "error" in result && result.error) {
        setErrors(result.error as Record<string, string[]>);
        toast.error("Please fix the errors below");
      } else if (result && "success" in result && result.success) {
        toast.success(`${submitLabel}d successfully`);
      }
    });
  }

  function ErrorMsg({ name }: { name: string }) {
    if (!errors[name]) return null;
    return <p className="text-xs text-red-600 mt-1">{errors[name][0]}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors._form && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
          {errors._form[0]}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            name="name"
            required
            defaultValue={product?.name || ""}
            className="input"
            disabled={pending}
          />
          <ErrorMsg name="name" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Slug <span className="text-xs text-slate-400">(URL-safe, lowercase)</span>
          </label>
          <input
            name="slug"
            required
            defaultValue={product?.slug || ""}
            placeholder="my-product"
            pattern="^[a-z0-9-]+$"
            className="input font-mono"
            disabled={pending}
          />
          <ErrorMsg name="slug" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={product?.description || ""}
          className="input"
          disabled={pending}
        />
        <ErrorMsg name="description" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select
            name="category"
            required
            defaultValue={product?.category || categoryOptions[0]}
            className="input"
            disabled={pending}
          >
            {categoryOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <ErrorMsg name="category" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Price per day <span className="text-xs text-slate-400">(USD)</span>
          </label>
          <input
            name="price_per_day_dollars"
            type="number"
            required
            min={0}
            step={1}
            defaultValue={product ? Math.round(product.price_per_day / 100) : 299}
            className="input"
            disabled={pending}
          />
          <ErrorMsg name="price_per_day" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Cost <span className="text-xs text-slate-400">(USD, internal — not shown to customer)</span>
          </label>
          <input
            name="cost_dollars"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product ? (product.cost_cents / 100).toFixed(2) : "0"}
            className="input"
            disabled={pending}
            placeholder="What it cost you to acquire"
          />
          <ErrorMsg name="cost_cents" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Weekend rate <span className="text-xs text-slate-400">(USD, Sat/Sun — blank = use weekday price)</span>
          </label>
          <input
            name="weekend_price_per_day_dollars"
            type="number"
            min={0}
            step={1}
            defaultValue={
              product && product.weekend_price_per_day
                ? Math.round(product.weekend_price_per_day / 100)
                : ""
            }
            className="input"
            disabled={pending}
            placeholder="e.g. 349"
          />
          <ErrorMsg name="weekend_price_per_day" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
          <input
            name="stock"
            type="number"
            min={0}
            max={100}
            defaultValue={product?.stock ?? 1}
            className="input"
            disabled={pending}
          />
          <ErrorMsg name="stock" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
        <input
          name="image_url"
          type="url"
          defaultValue={product?.image_url || ""}
          placeholder="https://example.com/image.jpg"
          className="input"
          disabled={pending}
        />
        <ErrorMsg name="image_url" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Setup area</label>
          <input
            name="setup_area"
            defaultValue={product?.setup_area || ""}
            placeholder="15x15 ft"
            className="input"
            disabled={pending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Actual size</label>
          <input
            name="actual_size"
            defaultValue={product?.actual_size || ""}
            placeholder="13x13 ft"
            className="input"
            disabled={pending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Outlets required</label>
          <input
            name="outlets_required"
            type="number"
            min={0}
            max={10}
            defaultValue={product?.outlets_required ?? 1}
            className="input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Age group</label>
          <input
            name="age_group"
            defaultValue={product?.age_group || "All ages"}
            className="input"
            disabled={pending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">GHL Listing ID</label>
          <input
            name="ghl_listing_id"
            defaultValue={product?.ghl_listing_id || ""}
            placeholder="(optional, for GHL sync)"
            className="input font-mono"
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-3">
          <input
            name="is_active"
            type="checkbox"
            id="is_active"
            defaultChecked={product?.is_active ?? true}
            className="w-4 h-4 rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
            disabled={pending}
          />
          <label htmlFor="is_active" className="text-sm text-slate-700">
            Active (visible to customers on itsalwaysfun.net)
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            name="is_addon"
            type="checkbox"
            id="is_addon"
            defaultChecked={product?.is_addon ?? false}
            className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
            disabled={pending}
          />
          <label htmlFor="is_addon" className="text-sm text-slate-700">
            <strong>Add-on</strong> (hidden from public catalog — only added to bookings via wizard, e.g. Power Supply)
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="px-4 py-2 text-slate-600 hover:text-slate-900"
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
