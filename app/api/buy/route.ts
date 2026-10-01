import { NextResponse, after } from "next/server";
import { rateLimitGuestBuyDb } from "@/lib/rate-limit-db";
import { resendGuestDownload, startGuestPurchase } from "@/lib/guest-purchase";
import { getBaseUrl } from "@/lib/get-region";

/**
 * POST /api/buy — the buy-now page's submit, and its "resend my link". Public by design (no
 * account needed), so it is guarded by the DURABLE limiter instead of a login: a purchase creates
 * a client record and opens a Paystack transaction, a resend can send an email. See
 * `lib/guest-purchase.ts`, including why neither answer may depend on the address.
 */
export async function POST(request: Request) {
  let body: { slug?: unknown; email?: unknown; firstName?: unknown; lastName?: unknown; resend?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const slug = str(body.slug);
  const email = str(body.email);
  if (!slug) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (await rateLimitGuestBuyDb(ip, email)) {
    return NextResponse.json({ error: "Too many attempts. Please try again in an hour." }, { status: 429 });
  }

  if (body.resend === true) {
    // Same answer, same speed, whether or not anything is sent: the work runs after the response.
    after(() => resendGuestDownload({ slug, email }).catch((err) => console.error("Guest resend error:", err)));
    return NextResponse.json({ resent: true });
  }

  try {
    const result = await startGuestPurchase({
      slug,
      email,
      firstName: str(body.firstName),
      lastName: str(body.lastName),
      baseUrl: await getBaseUrl(),
    });
    return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
  } catch (err) {
    console.error("Guest purchase error:", err);
    return NextResponse.json({ error: "Something went wrong starting your payment. Please try again." }, { status: 500 });
  }
}
