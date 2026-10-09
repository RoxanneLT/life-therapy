import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";

// Self-service password change now lives in My Profile → Password.
export default async function ChangePasswordRedirect() {
  await requireAccess("/admin/users/change-password");
  redirect("/admin/account?tab=password");
}
