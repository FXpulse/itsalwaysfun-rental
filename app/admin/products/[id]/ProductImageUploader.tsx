"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, ImageOff, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadProductImage } from "@/app/admin/site/actions";

export function ProductImageUploader({
  productId,
  currentUrl,
}: {
  productId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(currentUrl);
  const [pending, setPending] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPending(true);
    const formData = new FormData();
    formData.append("image", file);

    const result = await uploadProductImage(productId, formData);
    setPending(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ("url" in result && result.url) {
      setPreview(result.url);
      toast.success("Image uploaded — refreshing");
      router.refresh();
    }
  }

  return (
    <div className="flex items-start gap-6">
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 w-40 h-40 flex items-center justify-center flex-shrink-0">
        {preview ? (
          <Image
            src={preview}
            alt="Product preview"
            width={160}
            height={160}
            className="object-contain max-h-full"
            unoptimized
          />
        ) : (
          <div className="text-center text-slate-400 text-xs">
            <ImageOff className="h-8 w-8 mx-auto mb-1" />
            No image
          </div>
        )}
      </div>

      <div className="flex-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {pending ? "Uploading..." : preview ? "Replace image" : "Upload image"}
        </button>
        <p className="text-xs text-slate-500 mt-2">
          PNG, JPG, or WEBP · max 5 MB · square images look best (1:1 ratio)
        </p>
        {preview && (
          <a
            href={preview}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand-navy hover:underline mt-2"
          >
            <ExternalLink className="h-3 w-3" />
            View current image
          </a>
        )}
      </div>
    </div>
  );
}
