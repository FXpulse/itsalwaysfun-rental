import { redirect } from "next/navigation";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { Crumbs } from "../../Crumbs";
import { ArticleEditor } from "../ArticleEditor";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const me = await getSuperadminUser();
  if (!me) redirect("/superadmin/login?error=not_superadmin");
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Crumbs trail={[{ label: "Knowledge Base", href: "/superadmin/kb" }, { label: "New" }]} />
      <h1 className="text-2xl font-bold text-brand-navy mb-4">New article</h1>
      <ArticleEditor mode="new" />
    </div>
  );
}
