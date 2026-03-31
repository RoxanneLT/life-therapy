import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole("super_admin", "editor");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.BUNNY_ACCOUNT_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  try {
    const res = await fetch("https://api.bunny.net/billing", {
      headers: { AccessKey: key },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json({ error: "Bunny API error" }, { status: 502 });
    const data = await res.json();
    return NextResponse.json({ balance: data.Balance, charges: data.ThisMonthCharges });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
