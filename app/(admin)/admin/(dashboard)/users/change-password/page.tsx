import { redirect } from "next/navigation";

// Self-service password change now lives in My Profile → Password.
export default function ChangePasswordRedirect() {
  redirect("/admin/account?tab=password");
}
