import { NextRequest, NextResponse } from "next/server";
import { getAvailableDates } from "@/lib/availability";
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
  const config = SESSION_TYPES.find((s) => s.type === sessionType);

  if (!config) {
    return NextResponse.json({ error: "Invalid session type" }, { status: 400 });
  }

  const dates = await getAvailableDates();
  return NextResponse.json({ dates });
}
