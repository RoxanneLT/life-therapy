import { NextRequest, NextResponse } from "next/server";
import { processCampaigns } from "@/lib/campaign-process";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processCampaigns();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Campaign steps cron error:", error);
    return NextResponse.json(
      { error: "Failed to process campaign steps" },
      { status: 500 }
    );
  }
}
