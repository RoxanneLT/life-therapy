"use server";

import { requireRole } from "@/lib/auth";
import { addCredits } from "@/lib/credits";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function grantCreditsAction(formData: FormData) {
  await requireRole("super_admin");

  const studentId = formData.get("studentId") as string;
  const amount = parseInt(formData.get("amount") as string, 10);
  const description = (formData.get("description") as string) || "Admin grant";

  if (!studentId || !amount || amount < 1) {
    throw new Error("Invalid grant data");
  }

  await addCredits(studentId, amount, description);

  revalidatePath(`/admin/students/${studentId}`);
  redirect(`/admin/students/${studentId}`);
}
