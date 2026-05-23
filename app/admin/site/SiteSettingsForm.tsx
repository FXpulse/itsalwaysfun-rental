"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, Save } from "lucide-react";
import { updateSiteSettings, uploadLogo } from "./actions";

interface Setting {
  key: string;
  value: string | null;
  description: string | null;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  business: "Business info",
  social: "Social media",
  branding: "Logo & branding",
  home: "Home page content",
  footer: "Footer",
  general: "General",
};

// Settings that should render as textarea
const LONG_TEXT_KEYS = new Set([
  "hero_subtitle",
  "footer_description",
  "service_area",
]);

export function SiteSettingsForm({
  groupedSettings,
}: {
  groupedSettings: Record<string, Setting[]>;
}) {
  const [pending, startTransition] = useTransition();
  const [logoPending, setLogoPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track current logo URL for preview
  const currentLogo =
    groupedSettings.branding?.find((s) => s.key === "logo_url")?.value || "";
  const [logoPreview, setLogoPreview] = useState(currentLogo);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateSiteSettings(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Saved! Changes are live now.");
      }
    });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoPending(true);
    const formData = new FormData();
    formData.append("logo", file);

    const result = await uploadLogo(formData);
    setLogoPending(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ("url" in result && result.url) {
      setLogoPreview(result.url);
      toast.success("Logo uploaded! Refresh the public site to see.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Logo upload (special, separate from settings batch) */}
      <div className="card">
        <h2 className="text-lg font-semibold text-brand-navy mb-1">Logo</h2>
        <p className="text-xs text-slate-500 mb-4">
          PNG, JPG, WEBP or SVG · max 5 MB · shown in header
        </p>
        <div className="flex items-start gap-6">
          <div className="bg-slate-100 rounded p-4 flex items-center justify-center w-40 h-32">
            {logoPreview ? (
              <Image
                src={logoPreview}
                alt="Logo preview"
                width={140}
                height={100}
                className="object-contain max-h-full"
                unoptimized
              />
            ) : (
              <span className="text-xs text-slate-400">No logo</span>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoPending}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {logoPending ? "Uploading..." : "Upload new logo"}
            </button>
            <p className="text-xs text-slate-500 mt-2 break-all">
              Current URL: <code>{logoPreview}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Settings grouped by category */}
      {Object.entries(groupedSettings).map(([category, items]) => {
        if (category === "branding") return null; // handled above
        return (
          <div key={category} className="card">
            <h2 className="text-lg font-semibold text-brand-navy mb-4">
              {CATEGORY_LABELS[category] || category}
            </h2>
            <div className="space-y-4">
              {items.map((s) => {
                const isLong = LONG_TEXT_KEYS.has(s.key);
                return (
                  <div key={s.key}>
                    <label
                      htmlFor={s.key}
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      {humanizeKey(s.key)}
                    </label>
                    {s.description && (
                      <p className="text-xs text-slate-500 mb-1">{s.description}</p>
                    )}
                    {isLong ? (
                      <textarea
                        id={s.key}
                        name={s.key}
                        rows={3}
                        defaultValue={s.value || ""}
                        className="input"
                        disabled={pending}
                      />
                    ) : (
                      <input
                        id={s.key}
                        name={s.key}
                        type="text"
                        defaultValue={s.value || ""}
                        className="input"
                        disabled={pending}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Submit */}
      <div className="sticky bottom-0 bg-white p-4 border border-slate-200 rounded shadow-lg flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Changes apply <strong>immediately</strong> to the public site.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving..." : "Save all changes"}
        </button>
      </div>
    </form>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
