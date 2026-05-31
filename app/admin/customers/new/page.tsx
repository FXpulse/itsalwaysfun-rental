import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { CreateCustomerForm } from "./CreateCustomerForm";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/admin/customers" className="text-sm text-slate-500 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to customers
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white p-6 shadow-xl">
        <div className="text-xs uppercase tracking-wider text-indigo-100 mb-2 flex items-center gap-1">
          <UserPlus className="h-3 w-3" /> New customer
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">Add a customer manually</h1>
        <p className="text-sm text-indigo-100 mt-2">
          Create a portal account for someone who hasn't booked yet (or to assign them a coupon).
          You can optionally send them a magic link invite to sign in.
        </p>
      </div>

      <CreateCustomerForm />

      <p className="text-xs text-slate-400 text-center">
        💡 If the email already exists, we just refresh their info — we won't create a duplicate.
      </p>
    </div>
  );
}
