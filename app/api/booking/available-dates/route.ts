import { NextRequest, NextResponse } from "next/server";
import { getAvailableDates } from "@/lib/availability";
import { SESSION_TYPES } from "@/lib/booking-config";
import { rateLimitApi } from "@/lib/rate-limit";
import { getAuthenticatedAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const { success } = rateLimitApi(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const sessionType = request.nextUrl.searchParams.get("type");
  const adminMode = request.nextUrl.searchParams.get("admin") === "1";
  const config = SESSION_TYPES.find((s) => s.type === sessionType);

  if (!config) {
    return NextResponse.json({ error: "Invalid session type" }, { status: 400 });
  }

  // Admin users can see today's date, bypass min notice, and book further ahead
  let includeToday = false;
  let maxDaysOverride: number | undefined;
  if (adminMode) {
    const admin = await getAuthenticatedAdmin().catch(() => null);
    if (admin?.adminUser?.role === "super_admin" || admin?.adminUser?.role === "marketing") {
      includeToday = true;
      maxDaysOverride = 90; // 3 months for admin
    }
  }

  const dates = await getAvailableDates({ includeToday, maxDaysOverride });
  return NextResponse.json({ dates });
}
