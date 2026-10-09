import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/auth";
import { searchAdmin } from "@/lib/admin-search";

/** The header search, grouped and gated per group by the signed-in admin's role. Read-only. */
export async function GET(request: NextRequest) {
  let role;
  try {
    ({ adminUser: { role } } = await getAuthenticatedAdmin());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  return NextResponse.json({ groups: await searchAdmin(q, role) });
}
