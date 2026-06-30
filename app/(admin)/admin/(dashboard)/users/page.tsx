import { redirect } from "next/navigation";

// User management lives under Settings → Team. Keep this URL working.
export default function UsersIndexRedirect() {
  redirect("/admin/settings/team");
}
