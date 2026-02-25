import { NextResponse } from "next/server";
import { processOrderCleanup } from "@/lib/cron/order-cleanup";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processOrderCleanup();
  return NextResponse.json(result);
}
