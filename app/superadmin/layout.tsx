// /superadmin/* — SaaS owner view, independent of any tenant.
// Auth check is per-page (not in layout) so /superadmin/login can render
// without requiring auth.

export const dynamic = "force-dynamic";

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
