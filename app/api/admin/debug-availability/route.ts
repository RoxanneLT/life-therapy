import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { debugAvailability } from "@/app/(admin)/admin/(dashboard)/bookings/availability/actions";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
  }

  const result = await debugAvailability(date);
  return NextResponse.json(result, { status: 200 });
}
