import { prisma } from "@/lib/prisma";
import { baseTemplate } from "@/lib/email-templates";
import * as fallback from "@/lib/email-templates";

const DEFAULT_BASE_URL = "https://life-therapy.co.za";

// Sample data for each template (used in admin preview)
const SAMPLE_DATA: Record<string, Record<string, string>> = {
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
    tempPassword: "TempPass#2025",
    loginUrl: "https://life-therapy.co.za/portal/login",
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
};

// Title mapping for baseTemplate wrapper
const TEMPLATE_TITLES: Record<string, string> = {
  booking_confirmation: "Your Session is Confirmed!",
  booking_notification: "New Booking Received",
  booking_reminder: "Session Reminder",
  booking_cancellation: "Session Cancelled",
  order_confirmation: "Order Confirmation",
  account_created: "Welcome to Life-Therapy!",
  account_provisioned: "Your Account is Ready",
  course_completed: "Course Completed!",
  gift_received: "You've Received a Gift!",
  gift_delivered_buyer: "Gift Delivered!",
  password_changed: "Password Changed",
};

/**
 * Replace all {{variable}} placeholders in a string.
 * Unmatched placeholders are left as-is (empty string replacement if variable exists but is empty).
 */
function replacePlaceholders(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
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

  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { key },
    });

    if (template && template.isActive) {
      const subject = replacePlaceholders(template.subject, variables);
      const bodyHtml = replacePlaceholders(template.bodyHtml, variables);
      const title = TEMPLATE_TITLES[key] || template.name;
      const html = baseTemplate(title, bodyHtml, baseUrl, unsubscribeUrl);
      return { subject, html };
    }
  } catch {
    // DB not available or template table doesn't exist yet — fall through to fallback
  }

  // Fallback: use hardcoded templates
  return renderFallback(key, variables, baseUrl, unsubscribeUrl);
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

  if (overrides?.subject && overrides?.bodyHtml) {
    const subject = replacePlaceholders(overrides.subject, sampleVars);
    const bodyHtml = replacePlaceholders(overrides.bodyHtml, sampleVars);
    const title = TEMPLATE_TITLES[key] || key;
    const html = baseTemplate(title, bodyHtml);
    return { subject, html };
  }

  const template = await prisma.emailTemplate.findUnique({
    where: { key },
  });

  if (template) {
    const subject = replacePlaceholders(template.subject, sampleVars);
    const bodyHtml = replacePlaceholders(template.bodyHtml, sampleVars);
    const title = TEMPLATE_TITLES[key] || template.name;
    const html = baseTemplate(title, bodyHtml);
    return { subject, html };
  }

  // Fallback
  return renderFallback(key, sampleVars);
}

/**
 * Get sample variables for a given template key.
 */
export function getSampleData(key: string): Record<string, string> {
  return SAMPLE_DATA[key] || {};
}

// Fallback rendering using the original hardcoded template functions
function renderFallback(
  key: string,
  variables: Record<string, string>,
  baseUrl = DEFAULT_BASE_URL,
  unsubscribeUrl?: string
): { subject: string; html: string } {
  switch (key) {
    case "booking_confirmation":
      return {
        subject: `Booking Confirmed: ${variables.sessionType || "Session"} on ${variables.date || ""}`,
        html: baseTemplate(
          "Your Session is Confirmed!",
          `<p>Hi ${variables.clientName || ""},</p><p>Your session has been confirmed.</p>`,
          baseUrl, unsubscribeUrl
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
    case "password_changed":
      return {
        subject: "Your Life-Therapy password has been changed",
        html: baseTemplate(
          "Password Changed",
          `<p>Hi ${variables.firstName || ""},</p>
          <p>Your password has been successfully changed.</p>
          <p>If you did not make this change, please contact us immediately at <a href="mailto:hello@life-therapy.co.za" style="color: #8BA889;">hello@life-therapy.co.za</a>.</p>
          <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
          baseUrl, unsubscribeUrl
        ),
      };
    default:
      return {
        subject: `Email: ${key}`,
        html: baseTemplate(
          key,
          "<p>Template not found.</p>",
          baseUrl, unsubscribeUrl
        ),
      };
  }
}
