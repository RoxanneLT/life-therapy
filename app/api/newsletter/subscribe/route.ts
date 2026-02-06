import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Load Mailchimp settings from DB
    const settings = await prisma.siteSetting.findFirst({
      select: {
        mailchimpApiKey: true,
        mailchimpAudienceId: true,
        mailchimpServer: true,
      },
    });

    if (!settings?.mailchimpApiKey || !settings?.mailchimpAudienceId || !settings?.mailchimpServer) {
      return NextResponse.json(
        { error: "Newsletter is not configured yet. Please try again later." },
        { status: 503 }
      );
    }

    const { mailchimpApiKey, mailchimpAudienceId, mailchimpServer } = settings;

    // Call Mailchimp API directly (no SDK needed)
    const url = `https://${mailchimpServer}.api.mailchimp.com/3.0/lists/${mailchimpAudienceId}/members`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `apikey ${mailchimpApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        status: "subscribed",
        merge_fields: {
          FNAME: name || "",
        },
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true });
    }

    const data = await response.json();

    // Already subscribed is not an error for the user
    if (data.title === "Member Exists") {
      return NextResponse.json({ success: true });
    }

    console.error("Mailchimp error:", data);
    return NextResponse.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Newsletter subscribe error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
