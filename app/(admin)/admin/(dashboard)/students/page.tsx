import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";

export default async function StudentsRedirect() {
  await requireAccess("/admin/students");
  redirect("/admin/clients");
}
