import { NextResponse } from "next/server";
import { validateCoupon } from "@/lib/cart";

/**
 * POST /api/cart/validate-coupon
 * Validate a coupon code. Can be used by guest users.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, courseIds, packageIds, subtotalCents, currency } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { valid: false, error: "Code is required" },
        { status: 400 }
      );
    }

    const result = await validateCoupon(
      code,
      {
        courseIds: courseIds || [],
        packageIds: packageIds || [],
      },
      subtotalCents || 0,
      currency || "ZAR"
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    );
  }
}
