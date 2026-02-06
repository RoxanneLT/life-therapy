import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";
import { SESSION_TYPES } from "@/lib/booking-config";
import { rateLimitApi } from "@/lib/rate-limit";

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
  const dateStr = request.nextUrl.searchParams.get("date");

  const config = SESSION_TYPES.find((s) => s.type === sessionType);
  if (!config || !dateStr) {
    return NextResponse.json(
      { error: "Invalid parameters" },
      { status: 400 }
    );
  }

  const slots = await getAvailableSlots(dateStr, config);

  return NextResponse.json({ slots });
}
