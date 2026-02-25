import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(renderPage("Invalid Link", "This unsubscribe link is invalid."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const student = await prisma.student.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, email: true, emailOptOut: true },
  });

  if (!student) {
    return new NextResponse(renderPage("Invalid Link", "This unsubscribe link is invalid or has expired."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (student.emailOptOut) {
    return new NextResponse(renderPage("Already Unsubscribed", "You have already been unsubscribed from marketing emails."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { emailOptOut: true },
  });

  return new NextResponse(
    renderPage("Unsubscribed", "You have been unsubscribed from marketing emails. You will still receive essential emails about your account, orders, and bookings."),
    { headers: { "Content-Type": "text/html" } }
  );
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - Life-Therapy</title>
<style>body{font-family:'Poppins',Arial,sans-serif;background:#f9fafb;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;color:#333}
.card{background:#fff;border-radius:8px;padding:48px;max-width:480px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{color:#8BA889;margin:0 0 16px;font-size:24px}p{color:#555;line-height:1.6}
a{color:#8BA889;text-decoration:none;font-weight:600}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p><p style="margin-top:24px"><a href="/">Back to Life-Therapy</a></p></div></body></html>`;
}
