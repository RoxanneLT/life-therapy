import { redirect } from "next/navigation";

// Security now lives in My Profile (Two-Factor tab). Keep this URL working.
export default function SecurityRedirect() {
  redirect("/admin/account");
}
