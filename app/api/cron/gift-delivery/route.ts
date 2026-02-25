import { NextResponse } from "next/server";
import { processGiftDelivery } from "@/lib/cron/gift-delivery";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processGiftDelivery();
  return NextResponse.json(result);
}
