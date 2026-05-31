import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Upload, Download } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { BulkImportClient } from "./BulkImportClient";

export const dynamic = "force-dynamic";

export default async function BulkImportCustomersPage() {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/customers" className="text-sm text-slate-500 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to customers
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white p-6 shadow-xl">
        <div className="text-xs uppercase tracking-wider text-indigo-100 mb-2 flex items-center gap-1">
          <Upload className="h-3 w-3" /> Bulk import
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">Import customers from CSV</h1>
        <p className="text-sm text-indigo-100 mt-2">
          Upload a list (up to 500 rows). We'll create portal accounts and optionally send welcome emails.
        </p>
      </div>

      {/* Template */}
      <div className="card bg-amber-50 border-amber-200 p-4">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
          <Download className="h-4 w-4 text-amber-700" /> CSV format
        </h2>
        <p className="text-xs text-slate-600 mb-3">
          First row = headers. Only <strong>email</strong> is required. We accept these column names (case-insensitive):
        </p>
        <ul className="text-xs space-y-1">
          <li>• <code className="bg-white px-1 rounded">email</code> — required</li>
          <li>• <code className="bg-white px-1 rounded">first_name</code> / <code className="bg-white px-1 rounded">firstname</code> / <code className="bg-white px-1 rounded">first name</code></li>
          <li>• <code className="bg-white px-1 rounded">last_name</code> / <code className="bg-white px-1 rounded">lastname</code> / <code className="bg-white px-1 rounded">last name</code></li>
          <li>• <code className="bg-white px-1 rounded">phone</code> / <code className="bg-white px-1 rounded">mobile</code></li>
        </ul>
        <a
          href="data:text/csv;charset=utf-8,email,first_name,last_name,phone%0Amaria@example.com,Maria,Lopez,555-1234%0Acarlos@example.com,Carlos,Garcia,555-5678%0A"
          download="customers-template.csv"
          className="mt-3 inline-flex items-center gap-1 text-xs bg-white border border-amber-300 hover:border-amber-500 text-slate-700 rounded px-2 py-1 font-semibold"
        >
          <Download className="h-3 w-3" /> Download example CSV
        </a>
      </div>

      <BulkImportClient />
    </div>
  );
}
