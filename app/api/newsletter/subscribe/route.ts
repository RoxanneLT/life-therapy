import { NextRequest, NextResponse } from "next/server";
import { rateLimitNewsletterDb } from "@/lib/rate-limit-db";
import { upsertContact } from "@/lib/contacts";

export async function POST(request: NextRequest) {
  try {
    // Durable, not in-memory. This endpoint looks like a mailing-list signup and
    // reads like one, but `upsertContact` writes a real `students` row — the
    // write just lives one file away, which is also why the audit's high-value
    // check never saw it. The in-memory limiter keeps its counter inside a single
    // warm lambda, so the real ceiling was 3 × instances and reset on every cold
    // start: no limit at all on something that creates client records.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (await rateLimitNewsletterDb(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { name, email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    await upsertContact({
      email,
      firstName: name || undefined,
      source: "newsletter",
      consentGiven: true,
      consentMethod: "footer_form",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter subscribe error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
