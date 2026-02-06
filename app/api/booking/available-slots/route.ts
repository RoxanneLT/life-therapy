import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";
import { SESSION_TYPES } from "@/lib/booking-config";
import { parse } from "date-fns";

export async function GET(request: NextRequest) {
  const sessionType = request.nextUrl.searchParams.get("type");
  const dateStr = request.nextUrl.searchParams.get("date");

  const config = SESSION_TYPES.find((s) => s.type === sessionType);
  if (!config || !dateStr) {
    return NextResponse.json(
      { error: "Invalid parameters" },
      { status: 400 }
    );
  }

  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  const slots = await getAvailableSlots(date, config);

  return NextResponse.json({ slots });
}
