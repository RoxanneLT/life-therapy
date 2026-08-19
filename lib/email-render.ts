import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { escapeHtml } from "@/lib/utils";
import { baseTemplate } from "@/lib/email-templates";
import * as fallback from "@/lib/email-templates";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";

// Sample data for each template (used in admin preview)
const SAMPLE_DATA: Record<string, Record<string, string>> = {
  portal_welcome: {
    firstName: "Jane",
    email: "jane@example.com",
    tempPassword: "LT-Xk9mP2!", // NOSONAR — sample data for admin preview, not a real credential
    loginUrl: "https://life-therapy.co.za/login",
    sessionDate: "Tuesday, 11 March 2025",
    sessionTime: "10:00 – 10:30 (SAST)",
  },
  booking_confirmation: {
    clientName: "Jane Doe",
    sessionType: "Individual Therapy",
    date: "Monday, 10 March 2025",
    time: "10:00 – 11:00 (SAST)",
    duration: "60",
    priceSection:
      '<p style="margin: 8px 0;"><strong>Session fee:</strong> R850.00 (payment details will be sent separately)</p>',
    teamsSection:
      '<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 8px; font-weight: 600; color: #333;">Join your session:</p><a href="https://teams.microsoft.com/l/meetup-join/example" style="color: #8BA889; font-weight: 600; word-break: break-all;">https://teams.microsoft.com/l/meetup-join/example</a></div>',
    confirmationUrl: "https://life-therapy.co.za/book/confirmation?token=sample123",
  },
  booking_notification: {
    sessionType: "Individual Therapy",
    clientName: "Jane Doe",
    date: "Monday, 10 March 2025",
    time: "10:00 – 11:00 (SAST)",
    duration: "60",
    clientDetails:
      '<p style="margin: 4px 0;"><strong>Client:</strong> Jane Doe</p><p style="margin: 4px 0;"><strong>Email:</strong> jane@example.com</p><p style="margin: 4px 0;"><strong>Phone:</strong> +27 82 123 4567</p><p style="margin: 4px 0;"><strong>Notes:</strong> First session, experiencing work-related stress</p>',
    teamsLink:
      '<p><strong>Teams link:</strong> <a href="https://teams.microsoft.com/l/meetup-join/example">https://teams.microsoft.com/l/meetup-join/example</a></p>',
  },
  booking_reminder: {
    clientName: "Jane Doe",
    sessionType: "Individual Therapy",
    date: "Tuesday, 11 March 2025",
    time: "10:00 – 11:00 (SAST)",
    startTime: "10:00",
    teamsButton:
      '<div style="text-align: center; margin: 24px 0;"><a href="https://teams.microsoft.com/l/meetup-join/example" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Join Microsoft Teams Meeting</a></div>',
  },
  booking_cancellation: {
    clientName: "Jane Doe",
    sessionType: "Individual Therapy",
    date: "Monday, 10 March 2025",
    time: "10:00 – 11:00 (SAST)",
    bookUrl: "https://life-therapy.co.za/book",
  },
  order_confirmation: {
    firstName: "Jane",
    orderNumber: "LT-20250310-0001",
    orderDate: "10 March 2025",
    orderItemsTable: `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Understanding Self-Esteem (Full Course)</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: center;">1</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">R1,299.00</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Self-Esteem Workbook (Digital Product)</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: center;">1</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">R149.00</td>
      </tr>`,
    subtotal: "R1,448.00",
    discountRow:
      '<tr><td colspan="2" style="padding: 4px 0; text-align: right; color: #16a34a;">Discount</td><td style="padding: 4px 0; text-align: right; color: #16a34a;">-R100.00</td></tr>',
    total: "R1,348.00",
    portalUrl: "https://life-therapy.co.za/portal",
  },
  account_created: {
    firstName: "Jane",
    loginUrl: "https://life-therapy.co.za/portal/login",
  },
  account_provisioned: {
    firstName: "Jane",
    tempPassword: "TempPass#2025", // NOSONAR — sample data for admin preview, not a real credential
    loginUrl: "https://life-therapy.co.za/portal/login",
  },
  password_reset: {
    resetUrl: "https://life-therapy.co.za/reset-password?token=sample",
  },
  client_welcome: {
    clientName: "Jane Doe",
    portalUrl: "https://life-therapy.co.za/portal",
    creditsInfo:
      '<p style="margin: 8px 0;">You have <strong>5 session credits</strong> available.</p>',
  },
  course_completed: {
    firstName: "Jane",
    courseTitle: "Understanding Self-Esteem",
    certificateNumber: "LT-CERT-2025-0042",
    portalUrl: "https://life-therapy.co.za/portal/certificates",
  },
  gift_received: {
    recipientName: "Sarah",
    buyerName: "Jane",
    itemTitle: "Understanding Self-Esteem (Full Course)",
    messageBlock:
      '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 16px; margin: 16px 0; font-style: italic; color: #92400e;">&ldquo;Happy birthday! I thought this course would be perfect for you. Enjoy!&rdquo;<p style="margin: 8px 0 0; font-style: normal; font-size: 13px; color: #a16207;">&mdash; Jane</p></div>',
    redeemUrl: "https://life-therapy.co.za/gift/redeem?token=sample-token-123",
  },
  gift_delivered_buyer: {
    buyerName: "Jane",
    recipientName: "Sarah",
    itemTitle: "Understanding Self-Esteem (Full Course)",
  },
  password_changed: {
    firstName: "Jane",
  },
  booking_reschedule: {
    clientName: "Jane Doe",
    sessionType: "Individual Therapy",
    oldDate: "Monday, 10 March 2025",
    oldTime: "10:00 – 11:00 (SAST)",
    newDate: "Wednesday, 12 March 2025",
    newTime: "14:00 – 15:00 (SAST)",
    teamsSection:
      '<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 8px; font-weight: 600; color: #333;">Join your session:</p><a href="https://teams.microsoft.com/l/meetup-join/example" style="color: #8BA889; font-weight: 600; word-break: break-all;">https://teams.microsoft.com/l/meetup-join/example</a></div>',
  },
  booking_recurring_series: {
    clientName: "Jane Doe",
    sessionType: "Individual Therapy",
    pattern: "weekly",
    sessionCount: "24",
    dateList:
      '<ul style="padding-left: 20px; margin: 12px 0;"><li style="margin: 4px 0;">Monday, 10 March 2025 at 10:00 – 11:00 (SAST)</li><li style="margin: 4px 0;">Monday, 17 March 2025 at 10:00 – 11:00 (SAST)</li><li style="margin: 4px 0;">Monday, 24 March 2025 at 10:00 – 11:00 (SAST)</li></ul>',
    skippedNote: "",
    portalUrl: "https://life-therapy.co.za/portal/bookings",
  },
  legal_document_updated: {
    firstName: "Jane",
    documentTitle: "Terms & Conditions",
    changeSummary: "Updated cancellation window from 24h to 48h",
    portalUrl: "https://life-therapy.co.za/portal",
  },
  invoice: {
    billingName: "Jane Doe",
    invoiceNumber: "20260220-LT-JD-00001",
    invoiceDate: "20 February 2026",
    total: "R1,700.00",
  },
  payment_request: {
    billingName: "Jane Doe",
    month: "February 2026",
    sessionSummary: `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
      <tr><td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">Individual Session — 3 Feb 2026, 10:00–11:00</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">R850.00</td></tr>
      <tr><td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">Individual Session — 10 Feb 2026, 10:00–11:00</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">R850.00</td></tr>
    </table>`,
    total: "R1,700.00",
    dueDate: "28 February 2026",
    bankingDetails: `<div style="background: #f8faf8; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #333;">EFT Payment Details</p>
      <table style="width: 100%; font-size: 14px;">
        <tr><td style="padding: 2px 0; color: #6b7280; width: 120px;">Account Holder</td><td style="padding: 2px 0; font-weight: 500;">Life Therapy PTY Ltd</td></tr>
        <tr><td style="padding: 2px 0; color: #6b7280;">Bank</td><td style="padding: 2px 0; font-weight: 500;">First National Bank</td></tr>
        <tr><td style="padding: 2px 0; color: #6b7280;">Account Number</td><td style="padding: 2px 0; font-weight: 500;">1234567890</td></tr>
        <tr><td style="padding: 2px 0; color: #6b7280;">Branch Code</td><td style="padding: 2px 0; font-weight: 500;">250655</td></tr>
      </table>
    </div>`,
    paymentReference: "LT-2026-02-JD",
  },
  payment_request_reminder: {
    billingName: "Jane Doe",
    month: "February 2026",
    sessionSummary: `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
      <tr><td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">Individual Session — 3 Feb 2026, 10:00–11:00</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">R850.00</td></tr>
      <tr><td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">Individual Session — 10 Feb 2026, 10:00–11:00</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">R850.00</td></tr>
    </table>`,
    total: "R1,700.00",
    dueDate: "28 February 2026",
    bankingDetails: `<div style="background: #f8faf8; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e5e7eb;"><p style="margin: 0 0 8px; font-weight: 600; color: #333;">EFT Payment Details</p><table style="width: 100%; font-size: 14px;"><tr><td style="color: #6b7280;">Bank</td><td>First National Bank</td></tr><tr><td style="color: #6b7280;">Account</td><td>1234567890</td></tr></table></div>`,
    paymentReference: "LT-2026-02-JD",
  },
  payment_request_due_today: {
    billingName: "Jane Doe",
    month: "February 2026",
    sessionSummary: `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
      <tr><td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">Individual Session — 3 Feb 2026, 10:00–11:00</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">R850.00</td></tr>
    </table>`,
    total: "R850.00",
    bankingDetails: `<div style="background: #f8faf8; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e5e7eb;"><p style="margin: 0 0 8px; font-weight: 600; color: #333;">EFT Payment Details</p><table style="width: 100%; font-size: 14px;"><tr><td style="color: #6b7280;">Bank</td><td>First National Bank</td></tr><tr><td style="color: #6b7280;">Account</td><td>1234567890</td></tr></table></div>`,
    paymentReference: "LT-2026-02-JD",
  },
  payment_request_overdue: {
    billingName: "Jane Doe",
    month: "February 2026",
    sessionSummary: `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
      <tr><td style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">Individual Session — 3 Feb 2026, 10:00–11:00</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">R850.00</td></tr>
    </table>`,
    total: "R850.00",
    bankingDetails: `<div style="background: #f8faf8; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e5e7eb;"><p style="margin: 0 0 8px; font-weight: 600; color: #333;">EFT Payment Details</p><table style="width: 100%; font-size: 14px;"><tr><td style="color: #6b7280;">Bank</td><td>First National Bank</td></tr><tr><td style="color: #6b7280;">Account</td><td>1234567890</td></tr></table></div>`,
    paymentReference: "LT-2026-02-JD",
  },
  relationship_invite: {
    fromName: "Jane Doe",
    toName: "John",
    relationshipLabel: "partner",
    portalUrl: "https://life-therapy.co.za/portal/settings?tab=relationships",
  },
  relationship_invite_signup: {
    fromName: "Jane Doe",
    toName: "John",
    relationshipLabel: "partner",
    signupUrl: "https://life-therapy.co.za/portal/login",
  },
  couples_partner_invite: {
    partnerName: "Sarah",
    clientName: "Jane Doe",
    sessionType: "Couples Therapy",
    date: "Monday, 10 March 2025",
    time: "10:00 – 11:00 (SAST)",
    teamsSection:
      '<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 8px; font-weight: 600; color: #333;">Join your session:</p><a href="https://teams.microsoft.com/l/meetup-join/example" style="color: #8BA889; font-weight: 600; word-break: break-all;">https://teams.microsoft.com/l/meetup-join/example</a></div>',
  },
  credit_expiry_14d: {
    firstName: "Jane",
    creditCount: "3",
    creditWord: "credits",
    expiryDate: "14 March 2026",
    bookUrl: "https://life-therapy.co.za/book",
  },
  credit_expiry_3d: {
    firstName: "Jane",
    creditCount: "1",
    creditWord: "credit",
    expiryDate: "3 March 2026",
    bookUrl: "https://life-therapy.co.za/book",
  },
  dormant_60d: {
    firstName: "Jane",
    daysSince: "62",
    bookUrl: "https://life-therapy.co.za/book",
  },
  dormant_90d: {
    firstName: "Jane",
    daysSince: "94",
    bookUrl: "https://life-therapy.co.za/book",
  },
};

// Title mapping for baseTemplate wrapper
const TEMPLATE_TITLES: Record<string, string> = {
  portal_welcome: "Your Portal is Ready",
  booking_confirmation: "Your Session is Confirmed!",
  booking_notification: "New Booking Received",
  booking_reminder: "Session Reminder",
  booking_cancellation: "Session Cancelled",
  order_confirmation: "Order Confirmation",
  account_created: "Welcome to Life-Therapy!",
  account_provisioned: "Your Account is Ready",
  client_welcome: "Welcome to Life-Therapy!",
  course_completed: "Course Completed!",
  gift_received: "You've Received a Gift!",
  gift_delivered_buyer: "Gift Delivered!",
  password_reset: "Reset Your Password",
  password_changed: "Password Changed",
  booking_reschedule: "Session Rescheduled",
  booking_recurring_series: "Your Upcoming Sessions",
  legal_document_updated: "Document Updated",
  invoice: "Invoice",
  payment_request: "Payment Request",
  payment_request_reminder: "Payment Reminder",
  payment_request_due_today: "Payment Due Today",
  payment_request_overdue: "Payment Overdue",
  relationship_invite: "Relationship Link Request",
  relationship_invite_signup: "You've Been Invited to Life-Therapy",
  dormant_60d: "Checking In",
  dormant_90d: "We Miss You",
  couples_partner_invite: "Your Session Details",
  credit_expiry_14d: "Your Session Credits",
  credit_expiry_3d: "Your Session Credits",
};

/**
 * Replace all {{variable}} placeholders in a string.
 * Unmatched placeholders are left as-is (empty string replacement if variable exists but is empty).
 *
 * The one copy. Five identical versions of this existed — here and in four senders —
 * which is how escaping reached one caller and not the others: `escapeTemplateVariables`
 * was added at THIS one, and birthday, campaign, campaign-send and drip each went on
 * substituting client-supplied text into HTML unescaped. Escaping now happens at the
 * call sites, so this is the substitution and nothing else; keep it that way, and pass
 * escaped variables in.
 */
export function replacePlaceholders(
  template: string,
  variables: Record<string, string>
): string {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

/**
 * The variables whose values ARE markup, built by the call site.
 *
 * Everything else is escaped before it reaches a template — see `escapeTemplateVariables()`.
 * This list is the entire bypass, so each entry has to be a block the caller
 * assembles as HTML, and the caller owns escaping whatever it interpolates into
 * that block. Adding a name here is granting it the ability to inject.
 *
 * Kept honest by the `email-safety: only registered variables carry HTML` audit
 * check, which fails if a call site passes markup under any other name.
 */
const RAW_HTML_VARIABLES = new Set([
  "bankingDetails",   // send-invoice.ts — EFT details table
  "sessionSummary",   // send-invoice.ts — line-item table, incl. the balance rows
  "orderItemsTable",  // paystack webhook — order line rows
  "clientDetails",    // bookings/actions.ts — admin notification block
  "creditsInfo",      // clients/actions.ts — "you have N credits" with <strong>
  "dateList",         // bookings/actions.ts — <ul> of series dates
  "skippedNote",      // bookings/actions.ts — <p> naming skipped dates
  "teamsLink",        // bookings/actions.ts — admin's <a> to the meeting
  "teamsSection",     // book actions — client's "join your session" panel
  "teamsButton",      // cron/session-reminders.ts — the "join" button in a reminder
  "priceSection",     // book actions — <p> with the fee, or "" when free
  "discountRow",      // paystack webhook — a <tr> inside the order totals table
  "messageBlock",     // gift.ts — the buyer's note (escaped at the call site)
]);

/**
 * Escape every variable that is not a registered HTML block.
 *
 * `clientName` comes from the PUBLIC booking form — unauthenticated, no login,
 * anyone. It was interpolated straight into the confirmation email and into the
 * admin's notification, so a "name" of `<a href="http://evil">Click here</a>`
 * was delivered as working markup from the practice's own domain and DKIM
 * signature. That is a phishing email Roxanne sends on the attacker's behalf.
 *
 * Both render paths need it: the DB template substitutes `{{clientName}}` and
 * the hardcoded fallback interpolates `${variables.clientName}`. Escaping inside
 * replacePlaceholders would have covered only the first, and left the fallback —
 * the path used whenever a template is missing or inactive — wide open.
 */
export function escapeTemplateVariables(variables: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    safe[key] = RAW_HTML_VARIABLES.has(key) ? value : escapeHtml(value ?? "");
  }
  return safe;
}

/**
 * Render an email using DB template (if active) or fallback to hardcoded function.
 * Call sites pass pre-computed HTML for dynamic sections as variable values.
 */
export async function renderEmail(
  key: string,
  variables: Record<string, string>,
  baseUrl = DEFAULT_BASE_URL,
  unsubscribeToken?: string
): Promise<{ subject: string; html: string }> {
  const unsubscribeUrl = unsubscribeToken
    ? `${baseUrl}/api/unsubscribe?token=${unsubscribeToken}`
    : undefined;

  // Fetch site settings for footer contact details — graceful if DB unavailable
  let contactEmail: string | undefined;
  let contactPhone: string | undefined;
  try {
    const settings = await getSiteSettings();
    contactEmail = settings.email ?? undefined;
    contactPhone = settings.phone ?? undefined;
  } catch {
    // DB unavailable — fall through with hardcoded defaults in baseTemplate
  }

  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { key },
    });

    if (template?.isActive) {
      // The SUBJECT is plain text — a mail client renders it literally, so
      // escaping there would show a client called "Jane & John" as "Jane &amp;
      // John" in every inbox. The body is HTML and gets the escaped values.
      const subject = replacePlaceholders(template.subject, variables);
      const bodyHtml = replacePlaceholders(template.bodyHtml, escapeTemplateVariables(variables));
      const title = TEMPLATE_TITLES[key] || template.name;
      const html = baseTemplate(title, bodyHtml, baseUrl, unsubscribeUrl, contactEmail, contactPhone);
      return { subject, html };
    }
  } catch {
    // DB not available or template table doesn't exist yet — fall through to fallback
  }

  // Fallback: use hardcoded templates. Rendered twice on purpose — these are pure
  // string builders, and it is the only way to keep an unescaped subject beside an
  // escaped body without threading two variable maps through every case.
  const escaped = renderFallback(key, escapeTemplateVariables(variables), baseUrl, unsubscribeUrl, contactEmail, contactPhone);
  const rawSubject = renderFallback(key, variables, baseUrl, unsubscribeUrl, contactEmail, contactPhone);
  return { subject: rawSubject.subject, html: escaped.html };
}

/**
 * Render a preview of a template using sample data.
 * Used by admin preview and test email features.
 */
export async function previewEmail(
  key: string,
  overrides?: { subject?: string; bodyHtml?: string }
): Promise<{ subject: string; html: string }> {
  const sampleVars = SAMPLE_DATA[key] || {};

  let contactEmail: string | undefined;
  let contactPhone: string | undefined;
  try {
    const settings = await getSiteSettings();
    contactEmail = settings.email ?? undefined;
    contactPhone = settings.phone ?? undefined;
  } catch {
    // DB unavailable — fall through with hardcoded defaults
  }

  // The preview escapes exactly as a real send does — a preview that renders
  // markup the live email would show as text is a preview of a different email,
  // and this one is what the admin checks a template against before saving it.
  const safeVars = escapeTemplateVariables(sampleVars);

  if (overrides?.subject && overrides?.bodyHtml) {
    const subject = replacePlaceholders(overrides.subject, sampleVars);
    const bodyHtml = replacePlaceholders(overrides.bodyHtml, safeVars);
    const title = TEMPLATE_TITLES[key] || key;
    const html = baseTemplate(title, bodyHtml, DEFAULT_BASE_URL, undefined, contactEmail, contactPhone);
    return { subject, html };
  }

  const template = await prisma.emailTemplate.findUnique({
    where: { key },
  });

  if (template) {
    const subject = replacePlaceholders(template.subject, sampleVars);
    const bodyHtml = replacePlaceholders(template.bodyHtml, safeVars);
    const title = TEMPLATE_TITLES[key] || template.name;
    const html = baseTemplate(title, bodyHtml, DEFAULT_BASE_URL, undefined, contactEmail, contactPhone);
    return { subject, html };
  }

  // Fallback
  const escaped = renderFallback(key, safeVars, DEFAULT_BASE_URL, undefined, contactEmail, contactPhone);
  const rawSubject = renderFallback(key, sampleVars, DEFAULT_BASE_URL, undefined, contactEmail, contactPhone);
  return { subject: rawSubject.subject, html: escaped.html };
}

/**
 * Get sample variables for a given template key.
 */
export function getSampleData(key: string): Record<string, string> {
  return SAMPLE_DATA[key] || {};
}

// Fallback rendering using the original hardcoded template functions
/**
 * The hardcoded fallback for every template key, used when no ACTIVE DB template
 * exists for it.
 *
 * Exported so it can be tested. This path only runs in the failure case — when a
 * DB template is missing or an admin has deactivated one — which is precisely why
 * four keys sat here with no `case` for months without anyone noticing: rendering
 * through `renderEmail()` always hits the DB template first and masks the gap.
 * An untestable failure path is an untested one.
 */
export function renderFallback(
  key: string,
  variables: Record<string, string>,
  baseUrl = DEFAULT_BASE_URL,
  unsubscribeUrl?: string,
  contactEmail?: string,
  contactPhone?: string,
): { subject: string; html: string } {
  // Convenience wrapper that injects contact details into every baseTemplate call
  const bt = (title: string, body: string) =>
    baseTemplate(title, body, baseUrl, unsubscribeUrl, contactEmail, contactPhone);
  switch (key) {
    case "portal_welcome":
      return fallback.portalWelcomeEmail({
        firstName: variables.firstName || "",
        email: variables.email || "",
        tempPassword: variables.tempPassword || "",
        loginUrl: variables.loginUrl || "",
        sessionDate: variables.sessionDate || "",
        sessionTime: variables.sessionTime || "",
        baseUrl,
      });
    case "booking_confirmation":
      return {
        subject: `Booking Confirmed: ${variables.sessionType || "Session"} on ${variables.date || ""}`,
        html: bt(
          "Your Session is Confirmed!",
          `<p>Hi ${variables.clientName || ""},</p><p>Your session has been confirmed.</p>`,
        ),
      };

    // ── The four cases below had NO fallback until 2026-07-12 ─────────────────
    //
    // They fell through to `default:` — subject "Email: booking_cancellation",
    // body "<p>Template not found.</p>" — and sendEmail() still reported SUCCESS,
    // so nothing alerted anyone. It was masked only because email-template-defaults
    // seeds all four as ACTIVE DB rows, and the admin UI lets anyone toggle
    // isActive off. The day someone did, real clients would have received
    // "Template not found" for a cancellation.
    //
    // The variables below are exactly what the call sites pass — verified, not
    // guessed. Adding a variable at a call site without adding it here silently
    // renders a blank, so keep the two in step.

    case "booking_cancellation":
      // Sent to the client from bookings/actions.ts + portal/bookings/actions.ts.
      return {
        subject: `Session Cancelled: ${variables.sessionType || "Session"} on ${variables.date || ""}`,
        html: bt(
          "Your Session Has Been Cancelled",
          `<p>Hi ${variables.clientName || ""},</p>
          <p>Your <strong>${variables.sessionType || "session"}</strong> has been cancelled.</p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${variables.date || ""}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${variables.time || ""}</p>
          </div>
          <p>We're sorry to miss you. You're welcome to book another time whenever you're ready.</p>
          ${
            variables.bookUrl
              ? `<div style="text-align: center; margin: 24px 0;"><a href="${variables.bookUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Book a Session</a></div>`
              : ""
          }`,
        ),
      };

    case "booking_reminder":
      // Sent to the client from lib/cron/session-reminders.ts. `teamsButton` is a
      // pre-rendered HTML block (the call site builds it), not a URL.
      return {
        subject: `Reminder: your ${variables.sessionType || "session"} is coming up`,
        html: bt(
          "Your Session Is Coming Up",
          `<p>Hi ${variables.clientName || ""},</p>
          <p>This is a reminder of your upcoming <strong>${variables.sessionType || "session"}</strong>.</p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${variables.date || ""}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${variables.time || ""}</p>
          </div>
          ${variables.teamsButton || ""}
          <p>Looking forward to seeing you.</p>`,
        ),
      };

    case "booking_notification":
      // ADMIN-facing (goes to the practice inbox, not the client). `clientDetails`
      // and `teamsLink` arrive as pre-rendered HTML blocks.
      return {
        subject: `New Booking: ${variables.sessionType || "Session"} — ${variables.clientName || ""} on ${variables.date || ""}`,
        html: bt(
          "New Booking",
          `<p>A new session has been booked.</p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Client:</strong> ${variables.clientName || ""}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${variables.sessionType || ""}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${variables.date || ""}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${variables.time || ""}</p>
            <p style="margin: 4px 0;"><strong>Duration:</strong> ${variables.duration || ""} minutes</p>
          </div>
          ${variables.clientDetails || ""}
          ${variables.teamsLink || ""}`,
        ),
      };

    case "order_confirmation":
      // Sent to the buyer from the Paystack webhook. `orderItemsTable` and
      // `discountRow` are pre-rendered HTML; `subtotal`/`total` are already
      // formatted money strings (formatPrice at the call site).
      return {
        subject: `Order Confirmed — ${variables.orderNumber || ""}`,
        html: bt(
          "Thank You for Your Order",
          `<p>Hi ${variables.firstName || ""},</p>
          <p>Your order is confirmed and your purchase is ready in your portal.</p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Order Number:</strong> ${variables.orderNumber || ""}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${variables.orderDate || ""}</p>
          </div>
          ${variables.orderItemsTable || ""}
          <p style="margin: 4px 0;">Subtotal: ${variables.subtotal || ""}</p>
          ${variables.discountRow || ""}
          <p style="margin: 8px 0;"><strong>Total: ${variables.total || ""}</strong></p>
          ${
            variables.portalUrl
              ? `<div style="text-align: center; margin: 24px 0;"><a href="${variables.portalUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to My Portal</a></div>`
              : ""
          }`,
        ),
      };
    case "account_created":
      return fallback.accountCreatedEmail({
        firstName: variables.firstName || "",
        loginUrl: variables.loginUrl || "",
        baseUrl,
      });
    case "account_provisioned":
      return fallback.accountProvisionedEmail({
        firstName: variables.firstName || "",
        tempPassword: variables.tempPassword || "",
        loginUrl: variables.loginUrl || "",
        baseUrl,
      });
    case "course_completed":
      return fallback.courseCompletedEmail({
        firstName: variables.firstName || "",
        courseTitle: variables.courseTitle || "",
        certificateNumber: variables.certificateNumber || "",
        portalUrl: variables.portalUrl || "",
        baseUrl,
      });
    case "gift_delivered_buyer":
      return fallback.giftDeliveredToBuyerEmail({
        buyerName: variables.buyerName || "",
        recipientName: variables.recipientName || "",
        itemTitle: variables.itemTitle || "",
        baseUrl,
      });
    case "gift_received":
      return fallback.giftReceivedEmail({
        recipientName: variables.recipientName || "",
        buyerName: variables.buyerName || "",
        itemTitle: variables.itemTitle || "",
        message: variables.messageBlock || null,
        redeemUrl: variables.redeemUrl || "",
        baseUrl,
      });
    case "client_welcome":
      return {
        subject: "Welcome to Life-Therapy — You're All Set!",
        html: bt(
          "Welcome to Life-Therapy!",
          `<p>Hi ${variables.clientName || ""},</p>
          <p>Welcome! You are now an active client at Life-Therapy. We're looking forward to supporting you on your journey.</p>
          ${variables.creditsInfo || ""}
          <p>From your portal you can:</p>
          <ul>
            <li>Book and manage your sessions</li>
            <li>View your session credits</li>
            <li>Complete your personal assessment</li>
            <li>Update your profile and preferences</li>
          </ul>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.portalUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Go to My Portal</a>
          </div>
          <p>If you have any questions, feel free to reply to this email.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "password_reset":
      return {
        subject: "Reset Your Password — Life-Therapy",
        html: bt(
          "Reset Your Password",
          `<p>Hi there,</p>
          <p>We received a request to reset your password. Click the button below to choose a new one:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.resetUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Reset Password</a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">This link expires in 1 hour. If you didn&rsquo;t request a password reset, you can safely ignore this email.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "password_changed":
      return {
        subject: "Your Life-Therapy password has been changed",
        html: bt(
          "Password Changed",
          `<p>Hi ${variables.firstName || ""},</p>
          <p>Your password has been successfully changed.</p>
          <p>If you did not make this change, please contact us immediately at <a href="mailto:${contactEmail || "hello@life-therapy.co.za"}" style="color: #8BA889;">${contactEmail || "hello@life-therapy.co.za"}</a>.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "booking_reschedule": {
      const teamsSection = variables.teamsUrl
        ? `<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 8px; font-weight: 600; color: #333;">Join your session:</p><a href="${variables.teamsUrl}" style="color: #8BA889; font-weight: 600; word-break: break-all;">${variables.teamsUrl}</a></div>`
        : "";
      return {
        subject: `Session Rescheduled: ${variables.sessionType || "Session"} — New Date ${variables.newDate || ""}`,
        html: bt(
          "Session Rescheduled",
          `<p>Hi ${variables.clientName || ""},</p>
          <p>Your session has been rescheduled. Here are the updated details:</p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0; color: #6b7280; text-decoration: line-through;"><strong>Was:</strong> ${variables.oldDate || ""} at ${variables.oldTime || ""}</p>
            <p style="margin: 8px 0 4px; font-size: 16px;"><strong>Now:</strong> ${variables.newDate || ""} at ${variables.newTime || ""}</p>
            <p style="margin: 4px 0;"><strong>Session:</strong> ${variables.sessionType || ""}</p>
          </div>
          ${teamsSection}
          <p>If you have any questions, feel free to reply to this email.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    }
    case "booking_recurring_series":
      return {
        subject: `Your Upcoming ${variables.sessionType || "Sessions"} with Life-Therapy`,
        html: bt(
          "Your Upcoming Sessions",
          `<p>Hi ${variables.clientName || ""},</p>
          <p>Your ${variables.pattern || ""} <strong>${variables.sessionType || ""}</strong> sessions have been scheduled. Here are your upcoming dates:</p>
          ${variables.dateList || ""}
          ${variables.skippedNote || ""}
          <p>Each session has a unique Microsoft Teams meeting link — you'll find it in your portal for each session.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.portalUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View My Sessions</a>
          </div>
          <p>If you need to reschedule any individual session, you can do so from your portal or contact me directly.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "legal_document_updated":
      return {
        subject: `Updated ${variables.documentTitle || "Document"} — Please Review`,
        html: bt(
          "Document Updated",
          `<p>Hi ${variables.firstName || ""},</p>
          <p>We've updated our <strong>${variables.documentTitle || "document"}</strong>. Here's a summary of what changed:</p>
          <div style="background: #f9fafb; border-left: 4px solid #8BA889; border-radius: 4px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; color: #555; font-style: italic;">&ldquo;${variables.changeSummary || ""}&rdquo;</p>
          </div>
          <p>Please log in to your portal to review and accept the updated agreement:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.portalUrl || baseUrl}/review-documents" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Review Now</a>
          </div>
          <p style="color: #dc2626; font-weight: 600;">This is required to continue booking sessions.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "invoice":
      return {
        subject: `Life Therapy Invoice ${variables.invoiceNumber || ""}`,
        html: bt(
          "Invoice",
          `<p>Hi ${variables.billingName || ""},</p>
          <p>Please find your invoice attached.</p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Invoice:</strong> ${variables.invoiceNumber || ""}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${variables.invoiceDate || ""}</p>
            <p style="margin: 4px 0;"><strong>Amount:</strong> ${variables.total || ""}</p>
          </div>
          <p>Your invoice is attached as a PDF to this email.</p>
          <p>If you have any questions about this invoice, please reply to this email.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "payment_request":
      return {
        subject: `Your Life Therapy sessions for ${variables.month || ""}`,
        html: bt(
          "Payment Request",
          `<p>Hi ${variables.billingName || ""},</p>
          <p>Here is a summary of your sessions for <strong>${variables.month || ""}</strong>:</p>
          ${variables.sessionSummary || ""}
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Total Due:</strong> ${variables.total || ""}</p>
            <p style="margin: 4px 0;"><strong>Due Date:</strong> ${variables.dueDate || ""}</p>
            <p style="margin: 4px 0;"><strong>Payment Reference:</strong> ${variables.paymentReference || ""}</p>
          </div>
          ${variables.bankingDetails || ""}
          <p style="font-size: 13px; color: #6b7280;">A detailed pro-forma invoice is attached to this email for your records.</p>
          <p>If you have any questions, please reply to this email.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "payment_request_reminder":
      return {
        subject: `Friendly reminder — payment due ${variables.dueDate || ""}`,
        html: bt(
          "Payment Reminder",
          `<p>Hi ${variables.billingName || ""},</p>
          <p>Just a friendly reminder that your payment of <strong>${variables.total || ""}</strong> is due on <strong>${variables.dueDate || ""}</strong>.</p>
          ${variables.sessionSummary || ""}
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Payment Reference:</strong> ${variables.paymentReference || ""}</p>
          </div>
          ${variables.bankingDetails || ""}
          <p style="font-size: 13px; color: #6b7280;">The pro-forma invoice is attached for your convenience.</p>
          <p>If you&rsquo;ve already made payment, please disregard this message.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "payment_request_due_today":
      return {
        subject: `Payment due today — Life Therapy`,
        html: bt(
          "Payment Due Today",
          `<p>Hi ${variables.billingName || ""},</p>
          <p>This is a reminder that your payment of <strong>${variables.total || ""}</strong> is <strong>due today</strong>.</p>
          ${variables.sessionSummary || ""}
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Payment Reference:</strong> ${variables.paymentReference || ""}</p>
          </div>
          ${variables.bankingDetails || ""}
          <p style="font-size: 13px; color: #6b7280;">The pro-forma invoice is attached for your convenience.</p>
          <p>If you&rsquo;ve already made payment, please disregard this message.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "payment_request_overdue":
      return {
        subject: `Payment overdue — Life Therapy ${variables.month || ""}`,
        html: bt(
          "Payment Overdue",
          `<p>Hi ${variables.billingName || ""},</p>
          <p>We notice that your payment of <strong>${variables.total || ""}</strong> for <strong>${variables.month || ""}</strong> is now overdue.</p>
          ${variables.sessionSummary || ""}
          <p>Please arrange payment at your earliest convenience using the details below:</p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Payment Reference:</strong> ${variables.paymentReference || ""}</p>
          </div>
          ${variables.bankingDetails || ""}
          <p style="font-size: 13px; color: #6b7280;">The pro-forma invoice is attached for your records.</p>
          <p>If you&rsquo;ve already made payment or have any questions, please reply to this email.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "relationship_invite":
      return {
        subject: `${variables.fromName || "Someone"} wants to link with you on Life-Therapy`,
        html: bt(
          "Relationship Link Request",
          `<p>Hi ${variables.toName || ""},</p>
          <p><strong>${variables.fromName || "Someone"}</strong> would like to link with you as their <strong>${variables.relationshipLabel || "partner"}</strong> on Life-Therapy.</p>
          <p>Log in to your portal to accept or decline this request:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.portalUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View Request</a>
          </div>
          <p>If you don&rsquo;t recognise this request, you can safely ignore it.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "relationship_invite_signup":
      return {
        subject: `${variables.fromName || "Someone"} has invited you to Life-Therapy`,
        html: bt(
          "You've Been Invited to Life-Therapy",
          `<p>Hi ${variables.toName || ""},</p>
          <p><strong>${variables.fromName || "Someone"}</strong> would like to link with you as their <strong>${variables.relationshipLabel || "partner"}</strong> on Life-Therapy.</p>
          <p>Create your free account to connect:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.signupUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Sign Up</a>
          </div>
          <p>Once you&rsquo;ve created your account, you&rsquo;ll be able to accept the link request from your settings.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "couples_partner_invite":
      return {
        subject: `Your couples session — ${variables.date || ""}`,
        html: bt(
          "Your Session Details",
          `<p>Hi ${variables.partnerName || "there"},</p>
          <p><strong>${variables.clientName || ""}</strong> has booked a ${variables.sessionType || "couples session"} for the two of you, and asked that you receive the details.</p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${variables.date || ""}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${variables.time || ""}</p>
          </div>
          ${variables.teamsSection || ""}
          <p>You do not need an account or anything prepared — just come as you are.</p>
          <p>If this is a surprise, or the time does not work for you, please reply to this
          email or speak to ${variables.clientName || "them"} and we will find another slot.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "credit_expiry_14d":
      return {
        subject: `Your session ${variables.creditWord || "credits"} expire on ${variables.expiryDate || ""}`,
        html: bt(
          "Your Session Credits",
          `<p>Hi ${variables.firstName || ""},</p>
          <p>A gentle heads-up: you have <strong>${variables.creditCount || ""} session ${variables.creditWord || "credits"}</strong> waiting for you, and they expire on <strong>${variables.expiryDate || ""}</strong>.</p>
          <p>If you'd like to use ${variables.creditCount === "1" ? "it" : "them"}, you can pick a time that suits you:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.bookUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Book a Session</a>
          </div>
          <p>If the timing isn't right, just reply to this email and we'll sort something out together.</p>
          <p style="margin-top: 24px;">With warmth,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "credit_expiry_3d":
      return {
        subject: `Your session ${variables.creditWord || "credits"} expire on ${variables.expiryDate || ""}`,
        html: bt(
          "Your Session Credits",
          `<p>Hi ${variables.firstName || ""},</p>
          <p>Your <strong>${variables.creditCount || ""} session ${variables.creditWord || "credits"}</strong> expire on <strong>${variables.expiryDate || ""}</strong> — just a few days away.</p>
          <p>I didn't want ${variables.creditCount === "1" ? "it" : "them"} to slip by unnoticed:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.bookUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Book a Session</a>
          </div>
          <p>If you can't find a suitable time before then, reply to this email and we'll work something out.</p>
          <p style="margin-top: 24px;">With warmth,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "dormant_60d":
      return {
        subject: `Checking in — how are you doing, ${variables.firstName || ""}?`,
        html: bt(
          "Checking In",
          `<p>Hi ${variables.firstName || ""},</p>
          <p>I hope you're doing well. It's been a little while since our last session, and I just wanted to reach out and see how things are going for you.</p>
          <p>There's no pressure at all — I simply wanted you to know that I'm here whenever you feel ready to chat again. Sometimes life gets busy, and that's completely okay.</p>
          <p>If you'd like to book a session, you can do so anytime:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.bookUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Book a Session</a>
          </div>
          <p>Otherwise, I hope everything is going well in your world. Feel free to reply to this email if you'd like to talk about anything.</p>
          <p style="margin-top: 24px;">With warmth,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "dormant_90d":
      return {
        subject: `We miss you, ${variables.firstName || ""} — your space is always here`,
        html: bt(
          "We Miss You",
          `<p>Hi ${variables.firstName || ""},</p>
          <p>It's been about ${variables.daysSince || "90"} days since we last connected, and I've been thinking about you. I wanted you to know that your space here at Life-Therapy is always open — whenever the time feels right.</p>
          <p>I know that stepping back into therapy can feel like a big step, so I'd love to offer you a <strong>free 15-minute check-in call</strong> — no commitment, just a chance to reconnect and see where you're at.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.bookUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Book a Free Check-In</a>
          </div>
          <p>You've already done such meaningful work — and I'd love to continue supporting you whenever you're ready.</p>
          <p>Take care of yourself.</p>
          <p style="margin-top: 24px;">With warmth,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "teams_link_update":
      return {
        subject: "Your Life-Therapy Teams link has been updated",
        html: bt(
          "Your Teams link has been updated",
          `<p>Hi ${variables.clientName || "there"},</p>
          <p>Just a quick heads-up — we've refreshed the Microsoft Teams links for your upcoming sessions.</p>
          <p>Your next session is <strong>${variables.sessionDate || ""}${variables.sessionTime ? ` at ${variables.sessionTime}` : ""}</strong>:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${variables.joinUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Join your session</a>
          </div>
          <p style="font-size: 13px; color: #666;">For your later sessions, the correct link will be in your reminder email beforehand — no action needed. Please join from your reminder (or this button) rather than any older calendar invite.</p>
          <p style="margin-top: 24px;">See you soon,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    case "review_request":
      return {
        subject: "Would you share your experience with a quick Google review?",
        html: bt(
          "We'd love your feedback",
          `<p>Hi ${variables.clientName || "there"},</p>
          <p>Thank you for trusting Life-Therapy. If you have a moment, we'd be so grateful if you'd share your experience with a short Google review — it genuinely helps others find the support they need.</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${variables.reviewUrl || baseUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Leave a Google Review</a>
          </div>
          <p style="font-size: 13px; color: #666;">It only takes a minute, and it means a great deal to us. Thank you.</p>
          <p style="margin-top: 24px;">With warmth,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
        ),
      };
    default:
      return {
        subject: `Email: ${key}`,
        html: bt(key, "<p>Template not found.</p>"),
      };
  }
}
