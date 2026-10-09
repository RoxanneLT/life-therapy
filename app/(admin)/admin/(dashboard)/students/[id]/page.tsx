import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";

export default async function StudentDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccess("/admin/students");
  const { id } = await params;
  redirect(`/admin/clients/${id}`);
}
