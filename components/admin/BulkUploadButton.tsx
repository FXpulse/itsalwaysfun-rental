"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Upload, X, Download, FileText, Check, AlertTriangle } from "lucide-react";

interface BulkResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export function BulkUploadButton({
  label = "Bulk upload",
  templateUrl,
  uploadAction,
  description,
}: {
  label?: string;
  templateUrl: string; // e.g. /api/templates/products.csv
  uploadAction: (csvText: string) => Promise<BulkResult>;
  description?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Pick a CSV file");
      return;
    }
    startTransition(async () => {
      const text = await file.text();
      const r = await uploadAction(text);
      setResult(r);
      if (r.inserted > 0) {
        toast.success(`Imported ${r.inserted} row${r.inserted === 1 ? "" : "s"}`);
        router.refresh();
      }
      if (r.errors.length > 0) {
        toast.warning(`${r.skipped} skipped — see errors below`);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        <Upload className="h-4 w-4" /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={reset}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-brand-navy flex items-center gap-2">
                <Upload className="h-5 w-5" /> Bulk upload via CSV
              </h2>
              <button onClick={reset} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {description && <p className="text-sm text-slate-600 mb-3">{description}</p>}

            <a
              href={templateUrl}
              download
              className="block bg-slate-50 border border-slate-200 rounded p-3 mb-4 hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-brand-navy" />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-brand-navy">
                    Download CSV template
                  </div>
                  <div className="text-xs text-slate-500">
                    Open in Excel/Google Sheets, fill in your data, save as CSV, upload below.
                  </div>
                </div>
              </div>
            </a>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Choose CSV file
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  required
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setResult(null);
                  }}
                  className="input"
                  disabled={pending}
                />
                {file && (
                  <p className="text-xs text-slate-500 mt-1">
                    <FileText className="h-3 w-3 inline" /> {file.name} ({Math.round(file.size / 1024)}KB)
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={pending || !file} className="btn-primary inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {pending ? "Uploading..." : "Upload + import"}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>

            {result && (
              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 border border-green-200 rounded p-2 text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <strong>{result.inserted}</strong> imported
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <strong>{result.skipped}</strong> skipped
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                    <div className="font-semibold text-red-900 mb-1">Errors:</div>
                    {result.errors.slice(0, 50).map((err, i) => (
                      <div key={i} className="text-red-700 font-mono">
                        {err}
                      </div>
                    ))}
                    {result.errors.length > 50 && (
                      <div className="text-red-700 italic">
                        ...and {result.errors.length - 50} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
