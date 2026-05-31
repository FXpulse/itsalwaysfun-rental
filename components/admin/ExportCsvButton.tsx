// Reusable Export CSV button. Points at /api/admin/export/<entity>.csv which
// streams the current data with the same columns as the matching template.
// Same file works for re-import via bulk upload.

import { Download } from "lucide-react";

export function ExportCsvButton({
  entity,
  label = "Export CSV",
  className,
}: {
  entity: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`/api/admin/export/${entity}`}
      download
      className={
        className ||
        "inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-md px-3 py-2 ring-1 ring-slate-200 shadow-sm"
      }
      title={`Download current ${entity} data as CSV — re-importable`}
    >
      <Download className="h-4 w-4" /> {label}
    </a>
  );
}
