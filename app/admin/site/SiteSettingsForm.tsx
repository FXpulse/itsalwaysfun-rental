"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, Save, CheckCircle2, X } from "lucide-react";
import { updateSiteSettings, uploadLogo, uploadCustomFont, clearCustomFont } from "./actions";

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
  appearance: "Appearance — colors & fonts (per zone)",
  loyalty: "Loyalty & referrals (points + commission)",
  tax: "Sales tax / IVA / VAT",
};

// Keys that should render as a true/false dropdown instead of a free-text input
const BOOLEAN_KEYS = new Set(["tax_enabled"]);

// Settings that should render as textarea
const LONG_TEXT_KEYS = new Set([
  "hero_subtitle",
  "footer_description",
  "service_area",
]);

// Font family options — for per-zone overrides (full CSS values with fallback).
const FONT_OPTIONS = [
  { value: "", label: "Default (system)" },
  { value: "system-ui, sans-serif", label: "System UI" },
  { value: "'Quicksand', sans-serif", label: "Quicksand (LGC twin)" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Montserrat', sans-serif", label: "Montserrat" },
  { value: "'Nunito', sans-serif", label: "Nunito" },
  { value: "'Lato', sans-serif", label: "Lato" },
  { value: "Georgia, serif", label: "Georgia (serif)" },
  { value: "'Playfair Display', serif", label: "Playfair Display (serif)" },
  { value: "'Merriweather', serif", label: "Merriweather (serif)" },
  { value: "'Courier New', monospace", label: "Courier (mono)" },
  { value: "Impact, sans-serif", label: "Impact" },
  { value: "'Comic Sans MS', cursive", label: "Comic Sans (fun)" },
  { value: "'Louis George Cafe', sans-serif", label: "Louis George Cafe (self-hosted)" },
];

// Global site font presets: each option sets BOTH family name + Google Fonts URL at once.
// "Louis George Cafe" is special-cased: not on Google Fonts, requires self-hosted @font-face
// (see /admin/help section "Custom self-hosted font").
const SITE_FONT_PRESETS = [
  {
    label: "Quicksand (Louis George Cafe twin — recommended)",
    family: "Quicksand",
    url: "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap",
  },
  {
    label: "Nunito",
    family: "Nunito",
    url: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap",
  },
  {
    label: "Poppins",
    family: "Poppins",
    url: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
  },
  {
    label: "Inter",
    family: "Inter",
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  {
    label: "Montserrat",
    family: "Montserrat",
    url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap",
  },
  {
    label: "Playfair Display (elegant serif)",
    family: "Playfair Display",
    url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap",
  },
  {
    label: "Louis George Cafe (self-hosted — requires upload)",
    family: "Louis George Cafe",
    url: "",  // empty URL means admin self-hosts via @font-face in globals.css
  },
  {
    label: "Custom (type your own)",
    family: "",
    url: "",
  },
];

const GLOBAL_SITE_FONT_KEYS = new Set([
  "site_font_family",
  "site_font_google_url",
  "site_font_self_hosted_url",
]);

function isColorKey(key: string) {
  return key.endsWith("_color") || key.endsWith("_bg_color") || key.endsWith("_text_color");
}
function isFontKey(key: string) {
  return key.endsWith("_font_family") && !GLOBAL_SITE_FONT_KEYS.has(key);
}

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

        // Global font picker is rendered as a special widget at the top of "appearance"
        const globalFontFamily =
          items.find((i) => i.key === "site_font_family")?.value || "";
        const globalFontUrl =
          items.find((i) => i.key === "site_font_google_url")?.value || "";
        const globalFontSelfHostedUrl =
          items.find((i) => i.key === "site_font_self_hosted_url")?.value || "";
        const showSiteFontPicker = category === "appearance";

        return (
          <div key={category} className="card">
            <h2 className="text-lg font-semibold text-brand-navy mb-4">
              {CATEGORY_LABELS[category] || category}
            </h2>

            {showSiteFontPicker && (
              <SiteFontPicker
                initialFamily={globalFontFamily}
                initialUrl={globalFontUrl}
                initialSelfHostedUrl={globalFontSelfHostedUrl}
              />
            )}

            <div className="space-y-4">
              {items.map((s) => {
                // Skip the two global-font keys (handled by SiteFontPicker above)
                if (GLOBAL_SITE_FONT_KEYS.has(s.key)) return null;
                const isLong = LONG_TEXT_KEYS.has(s.key);
                const isColor = isColorKey(s.key);
                const isFont = isFontKey(s.key);
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
                    {BOOLEAN_KEYS.has(s.key) ? (
                      <select
                        id={s.key}
                        name={s.key}
                        defaultValue={(s.value || "false").toLowerCase()}
                        className="input"
                        disabled={pending}
                      >
                        <option value="false">No (disabled)</option>
                        <option value="true">Yes (enabled)</option>
                      </select>
                    ) : isFont ? (
                      <select
                        id={s.key}
                        name={s.key}
                        defaultValue={s.value || ""}
                        className="input"
                        disabled={pending}
                      >
                        {FONT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : isColor ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          defaultValue={s.value || "#ffffff"}
                          className="h-10 w-16 rounded border border-slate-300 cursor-pointer"
                          disabled={pending}
                          onChange={(e) => {
                            const text = document.getElementById(s.key) as HTMLInputElement;
                            if (text) text.value = e.target.value;
                          }}
                        />
                        <input
                          id={s.key}
                          name={s.key}
                          type="text"
                          defaultValue={s.value || ""}
                          placeholder="#1a1a6e, rgb(...), or empty"
                          className="input flex-1 font-mono text-sm"
                          disabled={pending}
                        />
                      </div>
                    ) : isLong ? (
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

/** Site-wide font picker. Sets all 3 keys atomically:
 *   site_font_family       — font family name
 *   site_font_google_url   — Google Fonts stylesheet URL (or empty)
 *   site_font_self_hosted_url — Supabase URL of uploaded .woff2/.ttf (or empty) */
function SiteFontPicker({
  initialFamily,
  initialUrl,
  initialSelfHostedUrl,
}: {
  initialFamily: string;
  initialUrl: string;
  initialSelfHostedUrl: string;
}) {
  const fontUploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selfHostedUrl, setSelfHostedUrl] = useState(initialSelfHostedUrl);

  // Match current values against presets to pick the initial dropdown index
  const initialPresetIdx = (() => {
    const idx = SITE_FONT_PRESETS.findIndex(
      (p) => p.family === initialFamily && p.url === initialUrl,
    );
    if (idx >= 0) return idx;
    // No exact match → "Custom"
    return SITE_FONT_PRESETS.length - 1;
  })();

  const [presetIdx, setPresetIdx] = useState(initialPresetIdx);
  const [customFamily, setCustomFamily] = useState(initialFamily);
  const [customUrl, setCustomUrl] = useState(initialUrl);

  const preset = SITE_FONT_PRESETS[presetIdx];
  const isCustom = presetIdx === SITE_FONT_PRESETS.length - 1;
  const isLouisGeorge = preset?.family === "Louis George Cafe";

  // Effective values that go into hidden inputs
  const family = isCustom ? customFamily : preset.family;
  const url = isCustom ? customUrl : preset.url;

  async function handleUploadFont(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("font", file);
    const r = await uploadCustomFont(fd);
    setUploading(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    if (r.url) {
      setSelfHostedUrl(r.url);
      toast.success("Font uploaded — save settings to activate");
    }
  }

  async function handleClearFont() {
    if (!confirm("Remove the self-hosted font? Site will fall back to Google Fonts or system.")) return;
    const r = await clearCustomFont();
    if (r.error) {
      toast.error(r.error);
      return;
    }
    setSelfHostedUrl("");
    toast.success("Self-hosted font cleared");
  }

  return (
    <div className="mb-6 bg-brand-yellow/10 border-l-4 border-brand-yellow rounded p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl">🅰️</div>
        <div className="flex-1">
          <h3 className="font-bold text-brand-navy">Site-wide font</h3>
          <p className="text-xs text-slate-600">
            Applied to ALL public pages (Home, Rentals, Items, Order, Reviews, etc.).
            Per-zone fonts below override this for individual sections if you want.
          </p>
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-700 mb-1">
        Choose a font
      </label>
      <select
        value={presetIdx}
        onChange={(e) => setPresetIdx(parseInt(e.target.value, 10))}
        className="input mb-3"
      >
        {SITE_FONT_PRESETS.map((p, i) => (
          <option key={i} value={i}>
            {p.label}
          </option>
        ))}
      </select>

      {isLouisGeorge && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 mb-3 space-y-2">
          <div>
            <strong>Louis George Cafe requires self-hosting.</strong> It's not on
            Google Fonts.
          </div>

          {selfHostedUrl ? (
            <div className="bg-white border border-green-300 rounded p-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-700 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-green-900 font-semibold">Font file uploaded ✓</div>
                <div className="text-[10px] text-slate-500 truncate">{selfHostedUrl}</div>
              </div>
              <button
                type="button"
                onClick={handleClearFont}
                className="text-red-600 hover:text-red-800 text-xs inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-2">
                <strong>1.</strong> Download the .woff2 file from{" "}
                <a
                  href="https://www.1001fonts.com/louis-george-cafe-font.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  1001fonts.com
                </a>{" "}
                (free for personal use — check commercial license if you need it)
                <br />
                <strong>2.</strong> Click upload below — gets stored in your Supabase{" "}
                <code>site-assets</code> bucket automatically
                <br />
                <strong>3.</strong> Save settings → font activates immediately, no redeploy
              </p>
              <input
                ref={fontUploadRef}
                type="file"
                accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                onChange={handleUploadFont}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fontUploadRef.current?.click()}
                disabled={uploading}
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Louis George Cafe (.woff2)"}
              </button>
            </div>
          )}

          <p className="text-[11px]">
            💡 Don't have the file yet? The <strong>Quicksand</strong> option above
            looks ~95% identical and works instantly with zero setup.
          </p>
        </div>
      )}

      {/* Generic self-hosted font option in Custom mode */}
      {isCustom && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-3">
          <p className="text-xs text-slate-700 mb-2">
            <strong>Self-hosted font:</strong> upload any .woff2/.woff/.ttf/.otf file.
            Used instead of the Google Fonts URL when present.
          </p>
          {selfHostedUrl ? (
            <div className="flex items-center gap-2 bg-white border border-green-300 rounded p-2">
              <CheckCircle2 className="h-4 w-4 text-green-700 flex-shrink-0" />
              <div className="flex-1 min-w-0 text-xs">
                <div className="text-green-900 font-semibold">Uploaded ✓</div>
                <div className="text-[10px] text-slate-500 truncate">{selfHostedUrl}</div>
              </div>
              <button
                type="button"
                onClick={handleClearFont}
                className="text-red-600 hover:text-red-800 text-xs inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          ) : (
            <>
              <input
                ref={fontUploadRef}
                type="file"
                accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                onChange={handleUploadFont}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fontUploadRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-3 w-3" />
                {uploading ? "Uploading..." : "Upload font file"}
              </button>
            </>
          )}
        </div>
      )}

      {isCustom && (
        <div className="space-y-2 mb-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Family name
            </label>
            <input
              type="text"
              value={customFamily}
              onChange={(e) => setCustomFamily(e.target.value)}
              placeholder="e.g. Raleway"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Google Fonts stylesheet URL (leave empty if self-hosted)
            </label>
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://fonts.googleapis.com/css2?family=..."
              className="input"
            />
          </div>
        </div>
      )}

      {/* Hidden inputs sent on Save. Self-hosted URL is only kept active for
          Louis George Cafe / Custom modes; Google presets clear it. */}
      <input type="hidden" name="site_font_family" value={family} />
      <input type="hidden" name="site_font_google_url" value={url} />
      <input
        type="hidden"
        name="site_font_self_hosted_url"
        value={isLouisGeorge || isCustom ? selfHostedUrl : ""}
      />

      {family && (
        <p className="text-xs text-slate-500 mt-2">
          Preview:{" "}
          <span
            style={{ fontFamily: `"${family}", system-ui, sans-serif` }}
            className="text-base"
          >
            The quick brown fox jumps over the lazy dog · 1234567890
          </span>
        </p>
      )}
    </div>
  );
}
