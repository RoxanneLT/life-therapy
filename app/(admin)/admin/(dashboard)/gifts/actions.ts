"use server";

import { requireRole } from "@/lib/auth";
import { sendGiftEmail } from "@/lib/gift";
import { revalidatePath } from "next/cache";

export async function resendGiftEmailAction(formData: FormData) {
  await requireRole("super_admin");

  const giftId = formData.get("giftId") as string;
  if (!giftId) throw new Error("Gift ID required");

  await sendGiftEmail(giftId);

  revalidatePath("/admin/gifts");
}
