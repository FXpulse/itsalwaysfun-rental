// /admin redirects to /admin/dashboard (auth middleware will bounce to /admin/login if needed)
import { redirect } from "next/navigation";

export default function AdminRoot() {
  redirect("/admin/dashboard");
}
