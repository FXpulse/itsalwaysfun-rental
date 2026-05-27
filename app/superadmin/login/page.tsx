// Superadmin login — independent of any tenant. Lives at
// getrentalflow.com/superadmin/login. After login, redirects to
// /superadmin/tenants (the SaaS owner's view across all tenants).

import { SuperadminLoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function SuperadminLoginPage() {
  return <SuperadminLoginForm />;
}
