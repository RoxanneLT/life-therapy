import { redirect } from "next/navigation";

// Gifts now live as a tab under Coupons & Gifts.
export default function GiftsPage() {
  redirect("/admin/coupons?tab=gifts");
}
