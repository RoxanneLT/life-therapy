export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { NewCouponForm } from "./new-coupon-form";

export default async function NewCouponPage() {
  await requireRole("super_admin");

  return <NewCouponForm />;
}
