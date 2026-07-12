import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { validateCoupon } from "@/lib/cart";
import { checkAndRecord } from "@/lib/rate-limit-db";

/**
 * POST /api/cart/validate-coupon
 * Validate a coupon code. Can be used by guest users.
 *
 * Unauthenticated by design — a guest must be able to try a code at checkout. That
 * makes it an ORACLE: without a limit, anyone can enumerate the code space and
 * harvest working discounts. Throttled durably (not the in-memory Map, which is
 * per-lambda on Vercel and therefore no limit at all against a distributed guess).
 *
 * 20 attempts/hour/IP: a real customer tries one or two codes.
 */
export async function POST(request: Request) {
  try {
    const ip =
      (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (await checkAndRecord(`coupon:ip:${ip}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { valid: false, error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

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
