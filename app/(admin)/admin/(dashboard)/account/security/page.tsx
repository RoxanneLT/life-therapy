import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";

// Security now lives in My Profile (Two-Factor tab). Keep this URL working.
export default async function SecurityRedirect() {
  await requireAccess("/admin/account");
  redirect("/admin/account");
}
