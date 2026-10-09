import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";

// Gifts now live as a tab under Coupons & Gifts.
export default async function GiftsPage() {
  await requireAccess("/admin/gifts");
  redirect("/admin/coupons?tab=gifts");
}
