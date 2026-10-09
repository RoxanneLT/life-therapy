import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";

// User management lives under Settings → Team. Keep this URL working.
export default async function UsersIndexRedirect() {
  await requireAccess("/admin/users");
  redirect("/admin/settings/team");
}
