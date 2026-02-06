import { NextRequest, NextResponse } from "next/server";
import { getAvailableDates } from "@/lib/availability";
import { SESSION_TYPES } from "@/lib/booking-config";

export async function GET(request: NextRequest) {
  const sessionType = request.nextUrl.searchParams.get("type");
  const config = SESSION_TYPES.find((s) => s.type === sessionType);

  if (!config) {
    return NextResponse.json({ error: "Invalid session type" }, { status: 400 });
  }

  const dates = await getAvailableDates();
  return NextResponse.json({ dates });
}
