/**
 * Drip Email & Campaign Readiness Audit
 *
 * Checks each email that references a URL to see if the destination
 * actually exists (has content / is wired up). Used to show
 * "Needs: XYZ" badges on the drip email admin cards.
 *
 * STATUS KEY:
 *   ✅ ready     — route exists and content is live
 *   ⚠️ no_content — route exists but no matching product/course in DB
 *   🔴 missing   — route does not exist at all
 *   🔗 dynamic   — URL is dynamic/variable (e.g. {{passwordResetUrl}})
 */

export interface LinkAuditItem {
  url: string;
  label: string;
  status: "ready" | "no_content" | "missing" | "dynamic";
  note: string;
}

export interface EmailAudit {
  key: string;        // e.g. "onboarding_0" or "newsletter_4"
  subject: string;
  issues: LinkAuditItem[];
}

// ============================================================
// Known link statuses — manually audited
// ============================================================

const LINK_STATUS: Record<string, { status: LinkAuditItem["status"]; note: string }> = {
  // ── WORKING ROUTES ──
  "/": { status: "ready", note: "Homepage" },
  "/book": { status: "ready", note: "Booking page" },
  "/book?type=free_consultation": { status: "ready", note: "Free consultation booking" },
  "/courses": { status: "ready", note: "Courses listing page" },
  "/products": { status: "ready", note: "Products listing page" },
  "/packages": { status: "ready", note: "Packages/bundles page" },
  "/login": { status: "ready", note: "Login page" },
  "/portal": { status: "ready", note: "Portal dashboard" },

  // ── CATEGORY FILTERS ──
  "/courses?category=self_esteem": { status: "ready", note: "Courses page filtered to self_esteem (Foundations published)" },
  "/courses?category=all:mental_wellness": { status: "no_content", note: "No published mental_wellness courses yet" },
  "/courses?category=relationships": { status: "no_content", note: "No published relationship courses yet" },

  // ── SHORT COURSES (standalone modules from Foundations of Self-Esteem) ──
  "/courses/short/assertiveness-and-boundary-setting": { status: "ready", note: "Short course: Assertiveness and Boundary-Setting" },
  "/courses/short/cultivating-resilience": { status: "ready", note: "Short course: Cultivating Resilience" },
  "/courses/short/challenging-negative-self-talk": { status: "ready", note: "Short course: Challenging Negative Self-Talk" },
  "/courses/short/embracing-imperfection": { status: "ready", note: "Short course: Embracing Imperfection" },
  "/courses/short/building-support-networks": { status: "ready", note: "Short course: Building Support Networks" },
  "/courses/short/the-building-blocks-of-self-esteem": { status: "ready", note: "Short course: The Building Blocks of Self-Esteem" },
  "/courses/short/setting-goals-and-celebrating-success": { status: "ready", note: "Short course: Setting Goals and Celebrating Success" },

  // ── SPECIFIC PRODUCT SLUGS (route exists, need actual product records) ──
  "/products/confidence-self-assessment-toolkit": { status: "ready", note: "Free product: Confidence Self-Assessment Toolkit" },
  "/products/boundary-setting-scripts": { status: "ready", note: "Paid product: Boundary-Setting Scripts Pack (R49)" },
  "/products/inner-critic-transformation-journal": { status: "ready", note: "Paid product: Inner Critic Transformation Journal (R49)" },
  "/products/values-discovery-workbook": { status: "ready", note: "Paid product: Values Discovery Workbook (R49)" },
  "/products/weekly-self-care-growth-tracker": { status: "ready", note: "Paid product: Weekly Self-Care & Growth Tracker (R49)" },
  "/products/daily-affirmations-planner": { status: "ready", note: "Free product: Daily Affirmations & Reflection Planner" },
  // ── FULL COURSES ──
  "/courses/foundations-of-self-esteem": { status: "ready", note: "Full course: The Foundations of Self-Esteem (published)" },

  // ── PACKAGES ──
  "/packages/inner-strength-bundle": { status: "ready", note: "Package: Inner Strength Bundle (R149)" },
  "/packages/confidence-starter-kit": { status: "ready", note: "Package: Confidence Starter Kit (R199)" },

  // ── ADDITIONAL PRODUCTS ──
  "/products/health-self-care-planner": { status: "ready", note: "Paid product: Health & Self-Care Planner (R49)" },
  "/products/relationship-journal-prompts": { status: "ready", note: "Paid product: 100 Relationship Journal Prompts (R49)" },
  "/products/30-day-self-worth-challenge": { status: "ready", note: "Free product: 30-Day Self-Worth Challenge" },

  // ── MISSING ROUTES (don't exist at all) ──
  "/products/self-esteem-snapshot": { status: "ready", note: "Free product: Self-Esteem Snapshot" },
  "/free/self-esteem-snapshot": { status: "ready", note: "Legacy redirect → /products/self-esteem-snapshot" },
  "/free/self-esteem-snapshot/download": { status: "ready", note: "Legacy redirect → /products/self-esteem-snapshot" },

  // ── DYNAMIC VARIABLES ──
  "{{passwordResetUrl}}": { status: "dynamic", note: "Generated per-recipient at send time ✅" },
};

/**
 * Get the audit status for a specific URL.
 */
export function auditLink(url: string, label: string): LinkAuditItem {
  const known = LINK_STATUS[url];
  if (known) {
    return { url, label, ...known };
  }

  // Unknown URL — flag it
  if (url.startsWith("{{")) {
    return { url, label, status: "dynamic", note: "Dynamic variable" };
  }
  if (url.startsWith("/")) {
    return { url, label, status: "no_content", note: "Internal link — status unknown, verify manually" };
  }
  return { url, label, status: "ready", note: "External link" };
}

/**
 * Count issues by severity for a set of emails.
 */
export function countIssues(audits: EmailAudit[]): {
  missing: number;     // 🔴 Routes that don't exist
  noContent: number;   // ⚠️ Routes exist but no DB content
  ready: number;       // ✅ Good to go
  total: number;
} {
  let missing = 0;
  let noContent = 0;
  let ready = 0;

  for (const audit of audits) {
    for (const issue of audit.issues) {
      if (issue.status === "missing") missing++;
      else if (issue.status === "no_content") noContent++;
      else if (issue.status === "ready") ready++;
    }
  }

  return { missing, noContent, ready, total: missing + noContent + ready };
}

// ============================================================
// Pre-computed audit for the drip email list page
// Maps drip email key → list of issues (only non-ready items)
// ============================================================

export const DRIP_LINK_ISSUES: Record<string, LinkAuditItem[]> = {
  // ONBOARDING
  onboarding_0: [
    auditLink("/products/self-esteem-snapshot", "CTA: Download Self-Esteem Snapshot"),
  ],
  onboarding_1: [
    auditLink("/products/self-esteem-snapshot", "P.S. link: Self-Esteem Snapshot"),
  ],
  onboarding_7: [
    auditLink("/courses", "CTA: Explore All Options"),
    auditLink("/book?type=free_consultation", "Inline link: free consultation"),
  ],
  onboarding_10: [
    auditLink("/courses", "CTA: Browse All Products"),
  ],
  onboarding_11: [
    auditLink("/book?type=free_consultation", "CTA: Book a Free Consultation"),
  ],

  // NEWSLETTER YEAR 1
  newsletter_0: [
    auditLink("/products/confidence-self-assessment-toolkit", "CTA: Confidence Self-Assessment Toolkit"),
  ],
  newsletter_1: [
    auditLink("/courses/short/assertiveness-and-boundary-setting", "CTA: Assertiveness and Boundary-Setting"),
  ],
  newsletter_2: [
    auditLink("/courses/short/challenging-negative-self-talk", "CTA: Challenging Negative Self-Talk"),
  ],
  newsletter_3: [
    auditLink("/book?type=free_consultation", "Inline link: free consultation"),
  ],
  newsletter_4: [
    auditLink("/courses/short/embracing-imperfection", "CTA: Embracing Imperfection"),
  ],
  newsletter_5: [
    auditLink("/book?type=free_consultation", "CTA: Book a Free Consultation"),
  ],
  newsletter_6: [
    auditLink("/products/boundary-setting-scripts", "CTA: Boundary-Setting Scripts Pack"),
  ],
  newsletter_8: [
    auditLink("/products/inner-critic-transformation-journal", "CTA: Inner Critic Transformation Journal"),
  ],
  newsletter_9: [
    auditLink("/courses/short/cultivating-resilience", "CTA: Cultivating Resilience"),
  ],
  newsletter_11: [
    auditLink("/book?type=free_consultation", "CTA: Book Free Check-In Consultation"),
  ],
  newsletter_12: [
    auditLink("/products/weekly-self-care-growth-tracker", "CTA: Weekly Self-Care & Growth Tracker"),
  ],
  newsletter_14: [
    auditLink("/courses/short/assertiveness-and-boundary-setting", "CTA: Assertiveness & Boundary-Setting"),
  ],
  newsletter_15: [
    auditLink("/products/health-self-care-planner", "CTA: Health & Self-Care Planner"),
  ],
  newsletter_18: [
    auditLink("/products/boundary-setting-scripts", "CTA: Boundary-Setting Scripts Pack"),
  ],
  newsletter_19: [
    auditLink("/packages/inner-strength-bundle", "CTA: Inner Strength Bundle"),
  ],
  newsletter_20: [
    auditLink("/products/values-discovery-workbook", "CTA: Values Discovery Workbook"),
  ],
  newsletter_22: [
    auditLink("/products/self-esteem-snapshot", "CTA: Retake Self-Esteem Snapshot"),
  ],
  newsletter_23: [
    auditLink("/courses", "CTA: Explore All Courses & Products"),
  ],

  // NEWSLETTER YEAR 2
  newsletter_26: [
    auditLink("/products/relationship-journal-prompts", "CTA: Relationship Journal Prompts"),
  ],
  newsletter_27: [
    auditLink("/courses/short/setting-goals-and-celebrating-success", "CTA: Setting Goals and Celebrating Success"),
  ],
  newsletter_29: [
    auditLink("/products/30-day-self-worth-challenge", "CTA: 30-Day Self-Worth Challenge"),
  ],
  newsletter_30: [
    auditLink("/courses/foundations-of-self-esteem", "CTA: The Foundations of Self-Esteem"),
  ],
  newsletter_31: [
    auditLink("/book?type=free_consultation", "CTA: Book a Free Consultation"),
  ],
  newsletter_32: [
    auditLink("/products/relationship-journal-prompts", "CTA: Relationship Journal Prompts"),
  ],
  newsletter_34: [
    auditLink("/courses/short/cultivating-resilience", "CTA: Cultivating Resilience"),
  ],
  newsletter_35: [
    auditLink("/products/self-esteem-snapshot", "CTA: Retake Self-Esteem Snapshot"),
  ],
  newsletter_37: [
    auditLink("/products/daily-affirmations-planner", "CTA: Daily Affirmations Planner"),
  ],
  newsletter_38: [
    auditLink("/book?type=free_consultation", "CTA: Book a Free Consultation"),
  ],
  newsletter_39: [
    auditLink("/products/values-discovery-workbook", "CTA: Values Discovery Workbook"),
  ],
  newsletter_40: [
    auditLink("/packages/inner-strength-bundle", "CTA: Inner Strength Bundle"),
  ],
  newsletter_42: [
    auditLink("/products/weekly-self-care-growth-tracker", "CTA: Weekly Self-Care & Growth Tracker"),
  ],
  newsletter_43: [
    auditLink("/packages", "CTA: Complete Confidence Journey Bundle"),
  ],
  newsletter_45: [
    auditLink("/packages/confidence-starter-kit", "CTA: Confidence Starter Kit"),
  ],
  newsletter_46: [
    auditLink("/products/self-esteem-snapshot", "CTA: Retake Self-Esteem Snapshot"),
  ],
};

/**
 * Get the worst status for a drip email (for badge colour).
 */
export function getWorstStatus(key: string): "ready" | "no_content" | "missing" | null {
  const issues = DRIP_LINK_ISSUES[key];
  if (!issues || issues.length === 0) return null; // No links to check

  let worst: "ready" | "no_content" | "missing" = "ready";
  for (const issue of issues) {
    if (issue.status === "missing") return "missing";
    if (issue.status === "no_content") worst = "no_content";
  }
  return worst;
}
