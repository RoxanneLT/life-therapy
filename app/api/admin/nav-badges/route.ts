import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth";
import { getNavBadges } from "@/lib/dashboard-attention";

/** Sidebar count badges for the signed-in admin, gated by their role. Read-only. */
export async function GET() {
  let role;
  try {
    ({ adminUser: { role } } = await getAuthenticatedAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ badges: await getNavBadges(role) });
}
