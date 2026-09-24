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
  let skipMinNotice = false;
  if (adminMode) {
    const admin = await getAuthenticatedAdmin().catch(() => null);
    if (admin?.adminUser?.role === "super_admin" || admin?.adminUser?.role === "marketing") {
      includeToday = true;
      skipMinNotice = true; // the same bypass the admin slot list gets
      maxDaysOverride = 90; // 3 months for admin
    }
  }

  // The session type was resolved above and then not used: the date list was answering "is this
  // day open" for nobody in particular. It now answers "can THIS session be booked that day",
  // which is the question the picker in front of the client is asking.
  const dates = await getAvailableDates({
    includeToday,
    maxDaysOverride,
    skipMinNotice,
    sessionConfig: config,
  });
  return NextResponse.json({ dates });
}
