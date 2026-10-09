export const dynamic = "force-dynamic";

import { requireAccess } from "@/lib/auth";
import { NewCouponForm } from "./new-coupon-form";

export default async function NewCouponPage() {
  await requireAccess("/admin/coupons");

  return <NewCouponForm />;
}
