"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveBranding } from "./actions";

export function BrandingEditor({
  initial,
}: {
  initial: {
    business_name: string;
    logo_url: string;
    primary_color: string;
    accent_color: string;
    font_family: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [business_name, setBusinessName] = useState(initial.business_name);
  const [logo_url, setLogoUrl] = useState(initial.logo_url);
  const [primary_color, setPrimaryColor] = useState(initial.primary_color);
  const [accent_color, setAccentColor] = useState(initial.accent_color);
  const [font_family, setFontFamily] = useState(initial.font_family);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = await saveBranding(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Branding saved — applying...");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="card space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Business name *
        </label>
        <input
          name="business_name"
          required
          value={business_name}
          onChange={(e) => setBusinessName(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Logo URL
        </label>
        <input
          name="logo_url"
          type="url"
          value={logo_url}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://your-cdn.com/logo.png"
          className="input"
        />
        {logo_url && (
          <div className="mt-2 p-2 bg-slate-100 rounded inline-block">
            <img src={logo_url} alt="Logo preview" className="h-12" />
          </div>
        )}
        <p className="text-xs text-slate-500 mt-1">
          Recommend transparent PNG, 200-400px wide, 60-100px tall.
          Upload to your own CDN (Cloudinary, ImgBB) or use Supabase Storage.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Primary color
          </label>
          <div className="flex items-center gap-2">
            <input
              name="primary_color"
              type="color"
              value={primary_color}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-12 rounded border border-slate-300 cursor-pointer"
            />
            <input
              type="text"
              value={primary_color}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="input font-mono text-sm flex-1"
              pattern="#[0-9a-fA-F]{6}"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Used for navigation, buttons, headings (dark color works best).
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Accent color
          </label>
          <div className="flex items-center gap-2">
            <input
              name="accent_color"
              type="color"
              value={accent_color}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-10 w-12 rounded border border-slate-300 cursor-pointer"
            />
            <input
              type="text"
              value={accent_color}
              onChange={(e) => setAccentColor(e.target.value)}
              className="input font-mono text-sm flex-1"
              pattern="#[0-9a-fA-F]{6}"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Used for highlights + CTAs (bright/contrasting color works best).
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Font family
        </label>
        <input
          name="font_family"
          value={font_family}
          onChange={(e) => setFontFamily(e.target.value)}
          className="input"
          placeholder="Quicksand, Inter, Roboto"
        />
        <p className="text-xs text-slate-500 mt-1">
          Any Google Font name. Defaults to Quicksand if unset.
        </p>
      </div>

      {/* Live preview */}
      <div className="border-t pt-4">
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Preview</div>
        <div
          className="rounded p-4 border-2"
          style={{
            backgroundColor: primary_color,
            color: accent_color,
            borderColor: accent_color,
            fontFamily: font_family,
          }}
        >
          <div className="text-2xl font-bold mb-2">{business_name || "Your Business"}</div>
          <button
            type="button"
            style={{
              backgroundColor: accent_color,
              color: primary_color,
            }}
            className="px-4 py-2 rounded font-bold text-sm"
          >
            Book Now
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-primary inline-flex items-center gap-2"
      >
        <Save className="h-4 w-4" /> {pending ? "Saving..." : "Save branding"}
      </button>
    </form>
  );
}
