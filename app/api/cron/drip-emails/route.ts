import { NextRequest, NextResponse } from "next/server";
import { processDripEmails } from "@/lib/drip-emails";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel cron sends this automatically)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDripEmails();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Drip email cron error:", error);
    return NextResponse.json(
      { error: "Failed to process drip emails" },
      { status: 500 }
    );
  }
}
