import { escapeHtml } from "./utils";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";

/**
 * Normalize user-authored campaign HTML for consistent email rendering.
 * Cleans up messy paste artifacts: empty paragraphs, inconsistent styles,
 * bare <br> runs, leftover font/color overrides.
 */
export function normalizeEmailHtml(html: string): string {
  let s = html;

  // Remove empty <p></p> and <p> </p> (with optional whitespace/nbsp)
  s = s.replace(/<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>/gi, "");

  // Convert double <br> sequences into paragraph breaks
  s = s.replace(/(<br\s*\/?\s*>){2,}/gi, "</p><p>");

  // Strip font-family, font-size, and color from inline styles (preserve other styles like text-align, margin)
  s = s.replace(/\bfont-family\s*:[^;"]+;?/gi, "");
  s = s.replace(/\bfont-size\s*:[^;"]+;?/gi, "");
  s = s.replace(/\bcolor\s*:[^;"]+;?/gi, "");

  // Clean up empty style attributes left behind
  s = s.replace(/\sstyle="\s*"/gi, "");

  // Ensure <p> tags have consistent email-safe styling
  // First, normalize <p> tags that already have a style attribute
  s = s.replace(/<p\s+style="([^"]*)"/gi, (_match, existingStyle: string) => {
    // Keep text-align if present, drop everything else
    const alignMatch = existingStyle.match(/text-align\s*:\s*[^;"]+/i);
    const align = alignMatch ? `${alignMatch[0]}; ` : "";
    return `<p style="${align}margin: 0 0 16px; line-height: 1.6"`;
  });

  // Then add style to bare <p> tags (no existing style attribute)
  s = s.replace(/<p(?=[\s>])(?![^>]*style=)/gi, '<p style="margin: 0 0 16px; line-height: 1.6"');

  // Unwrap <font> tags
  s = s.replace(/<\/?font[^>]*>/gi, "");

  // Remove <span> wrappers that have no meaningful attributes left
  s = s.replace(/<span(?:\s+style="\s*")?\s*>([\s\S]*?)<\/span>/gi, "$1");

  return s.trim();
}

export function baseTemplate(
  title: string,
  body: string,
  baseUrl = DEFAULT_BASE_URL,
  unsubscribeUrl?: string,
  contactEmail?: string,
  contactPhone?: string,
): string {
  const domain = baseUrl.replace(/^https?:\/\//, "");
  const email = contactEmail || "hello@life-therapy.co.za";
  const phone = contactPhone || "+27 71 017 0353";
  const unsubLine = unsubscribeUrl
    ? `<p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from marketing emails</a></p>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="${baseUrl}/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">
      ${title ? `<h3 style="color: #333; margin: 0 0 16px; font-size: 20px;">${title}</h3>` : ""}
      ${body}
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="${baseUrl}" style="color: #8BA889; text-decoration: none; font-weight: 600;">${domain}</a></p>
      <p style="margin: 0;">${email} &middot; ${phone}</p>
      ${unsubLine}
    </div>
  </div>
</body></html>`;
}

export function accountCreatedEmail(params: {
  firstName: string;
  loginUrl: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${escapeHtml(params.firstName)},</p>
    <p>Welcome to Life-Therapy! Your student account has been created successfully.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.loginUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Go to My Portal</a>
    </div>

    <p>From your portal, you can:</p>
    <ul style="color: #555; padding-left: 20px;">
      <li>Access your courses and track progress</li>
      <li>View certificates of completion</li>
      <li>Manage session credits and bookings</li>
      <li>Update your profile settings</li>
    </ul>

    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: "Welcome to Life-Therapy!",
    html: baseTemplate("Welcome to Life-Therapy!", body, params.baseUrl),
  };
}

export function accountProvisionedEmail(params: {
  firstName: string;
  tempPassword: string;
  loginUrl: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${escapeHtml(params.firstName)},</p>
    <p>An account has been created for you on Life-Therapy. You can use the credentials below to log in and access your courses.</p>

    <div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 15px;">${params.tempPassword}</code></p>
    </div>

    <p style="color: #dc2626; font-weight: 600;">You will be asked to change your password on first login.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.loginUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Log In Now</a>
    </div>

    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: "Your Life-Therapy Account",
    html: baseTemplate("Your Account is Ready", body, params.baseUrl),
  };
}

export function courseCompletedEmail(params: {
  firstName: string;
  courseTitle: string;
  certificateNumber: string;
  portalUrl: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${escapeHtml(params.firstName)},</p>
    <p>Congratulations! You have successfully completed <strong>${params.courseTitle}</strong>.</p>

    <div style="background: linear-gradient(135deg, #f0f7f4 0%, #e8f0e6 100%); border-radius: 6px; padding: 24px; margin: 16px 0; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Certificate Number</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333; letter-spacing: 1px;">${params.certificateNumber}</p>
    </div>

    <p>You can view and download your certificate from your student portal.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.portalUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View Certificate</a>
    </div>

    <p>Thank you for learning with us. We hope this course has been valuable on your personal development journey.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Congratulations! You completed ${params.courseTitle}`,
    html: baseTemplate("Course Completed!", body, params.baseUrl),
  };
}

export function giftDeliveredToBuyerEmail(params: {
  buyerName: string;
  recipientName: string;
  itemTitle: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${escapeHtml(params.buyerName)},</p>
    <p>Just a quick note to let you know that your gift has been delivered!</p>

    <div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Gift for ${escapeHtml(params.recipientName)}</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">${escapeHtml(params.itemTitle)}</p>
    </div>

    <p>${escapeHtml(params.recipientName)} has been sent an email with instructions to redeem their gift.</p>

    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Your gift for ${params.recipientName} has been delivered!`,
    html: baseTemplate("Gift Delivered!", body, params.baseUrl),
  };
}

export function giftReceivedEmail(params: {
  recipientName: string;
  buyerName: string;
  itemTitle: string;
  message?: string | null;
  redeemUrl: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const messageBlock = params.message
    ? `<div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 16px; margin: 16px 0; font-style: italic; color: #92400e;">
        &ldquo;${escapeHtml(params.message)}&rdquo;
        <p style="margin: 8px 0 0; font-style: normal; font-size: 13px; color: #a16207;">&mdash; ${escapeHtml(params.buyerName)}</p>
      </div>`
    : "";

  const body = `
    <p>Hi ${escapeHtml(params.recipientName)},</p>
    <p>Great news! <strong>${escapeHtml(params.buyerName)}</strong> has sent you a gift from Life-Therapy:</p>

    <div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center;">
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">🎁 ${escapeHtml(params.itemTitle)}</p>
    </div>

    ${messageBlock}

    <p>To access your gift, click the button below. If you don&rsquo;t have an account yet, you&rsquo;ll be able to create one during the redemption process.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.redeemUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Redeem Your Gift</a>
    </div>

    <p style="font-size: 13px; color: #6b7280;">This gift doesn&rsquo;t expire — you can redeem it anytime.</p>

    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `🎁 ${params.buyerName} sent you a gift from Life-Therapy!`,
    html: baseTemplate("You've Received a Gift!", body, params.baseUrl),
  };
}

export function portalWelcomeEmail(params: {
  firstName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  sessionDate: string;
  sessionTime: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${escapeHtml(params.firstName)},</p>
    <p>Your free consultation is confirmed for <strong>${params.sessionDate}</strong> at <strong>${params.sessionTime}</strong>.</p>
    <p>In the meantime, your personal portal is ready:</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.loginUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Login to Your Portal</a>
    </div>

    <div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Email:</strong> ${params.email}</p>
      <p style="margin: 4px 0;"><strong>Temporary password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 15px;">${params.tempPassword}</code></p>
    </div>

    <p style="color: #dc2626; font-weight: 600;">You&rsquo;ll be asked to set your own password on first login.</p>

    <p>In your portal you can:</p>
    <ul style="color: #555; padding-left: 20px;">
      <li>View your scheduled sessions</li>
      <li>Update your personal details</li>
    </ul>

    <p>Looking forward to meeting you!</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Accredited Coach &amp; Counsellor</p>
  `;

  return {
    subject: "Your Life Therapy Portal is Ready",
    html: baseTemplate("Your Portal is Ready", body, params.baseUrl),
  };
}
