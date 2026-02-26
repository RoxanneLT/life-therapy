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

  // ── CATEGORY FILTERS (route exists, depends on DB content) ──
  "/courses?category=all:mental_wellness": { status: "no_content", note: "Courses page with filter — needs courses tagged 'mental_wellness'" },
  "/courses?category=relationships": { status: "no_content", note: "Courses page with filter — needs courses tagged 'relationships'" },
  "/courses?category=self_esteem": { status: "no_content", note: "Courses page with filter — needs courses tagged 'self_esteem'" },

  // ── SPECIFIC COURSE SLUGS (route exists, need actual course records) ──
  "/courses/short/the-art-of-saying-no": { status: "no_content", note: "Short course: 'The Art of Saying No' — not yet created in DB" },
  "/courses/short/5-types-of-self-sabotage": { status: "no_content", note: "Short course: '5 Types of Self-Sabotage' — not yet created in DB" },
  "/courses/short/the-comparison-trap": { status: "no_content", note: "Short course: 'The Comparison Trap' — not yet created in DB" },
  "/courses/short/confidence-under-pressure": { status: "no_content", note: "Short course: 'Confidence Under Pressure' — not yet created in DB" },
  "/courses/short/emergency-anxiety-toolkit": { status: "no_content", note: "Short course: 'Emergency Anxiety Toolkit' — not yet created in DB" },
  "/courses/short/handling-boundary-pushback": { status: "no_content", note: "Short course: 'Handling Boundary Pushback' — not yet created in DB" },
  "/courses/short/negotiating-your-worth": { status: "no_content", note: "Short course: 'Negotiating Your Worth' — not yet created in DB" },
  "/courses/short/building-self-trust": { status: "no_content", note: "Short course: 'Building Self-Trust' — not yet created in DB" },
  "/courses/the-empowered-empath": { status: "no_content", note: "Full course: 'The Empowered Empath' — not yet created in DB" },

  // ── SPECIFIC PRODUCT SLUGS (route exists, need actual product records) ──
  "/products/confidence-self-assessment-toolkit": { status: "no_content", note: "Product: 'Confidence Self-Assessment Toolkit' — not yet created" },
  "/products/boundary-setting-scripts": { status: "no_content", note: "Product: 'Boundary-Setting Scripts Pack' — not yet created" },
  "/products/inner-critic-transformation-journal": { status: "no_content", note: "Product: 'Inner Critic Transformation Journal' — not yet created" },
  "/products/values-discovery-workbook": { status: "no_content", note: "Product: 'Values Discovery Workbook' — not yet created" },
  "/products/weekly-self-care-growth-tracker": { status: "no_content", note: "Product: 'Weekly Self-Care & Growth Tracker' — not yet created" },
  "/products/daily-affirmations-planner": { status: "no_content", note: "Product: 'Daily Affirmations & Reflection Planner' — not yet created" },
  "/products/self-esteem-starter-kit": { status: "no_content", note: "Product: 'Self-Esteem Starter Kit' — not yet created" },
  "/products/30-day-self-worth-challenge": { status: "no_content", note: "Product: '30-Day Self-Worth Challenge' — not yet created" },

  // ── MISSING ROUTES (don't exist at all) ──
  "/free/self-esteem-snapshot": { status: "ready", note: "Free assessment landing page" },
  "/free/self-esteem-snapshot/download": { status: "ready", note: "Redirects to landing page (PDF served from /downloads/)" },

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
    auditLink("/free/self-esteem-snapshot/download", "CTA: Download Self-Esteem Snapshot"),
  ],
  onboarding_1: [
    auditLink("/free/self-esteem-snapshot/download", "P.S. link: Self-Esteem Snapshot"),
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
    auditLink("/courses/short/the-art-of-saying-no", "CTA: The Art of Saying No"),
  ],
  newsletter_2: [
    auditLink("/courses/short/5-types-of-self-sabotage", "CTA: 5 Types of Self-Sabotage"),
  ],
  newsletter_3: [
    auditLink("/book?type=free_consultation", "Inline link: free consultation"),
  ],
  newsletter_4: [
    auditLink("/courses/short/the-comparison-trap", "CTA: The Comparison Trap"),
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
    auditLink("/courses/short/confidence-under-pressure", "CTA: Confidence Under Pressure"),
  ],
  newsletter_11: [
    auditLink("/book?type=free_consultation", "CTA: Book Free Check-In Consultation"),
  ],
  newsletter_12: [
    auditLink("/products/weekly-self-care-growth-tracker", "CTA: Weekly Self-Care & Growth Tracker"),
  ],
  newsletter_14: [
    auditLink("/courses?category=all:mental_wellness", "CTA: Boundary-Setting Resources"),
  ],
  newsletter_15: [
    auditLink("/courses/short/emergency-anxiety-toolkit", "CTA: Emergency Anxiety Toolkit"),
  ],
  newsletter_18: [
    auditLink("/courses/short/handling-boundary-pushback", "CTA: Handling Boundary Pushback"),
  ],
  newsletter_19: [
    auditLink("/courses/the-empowered-empath", "CTA: The Empowered Empath"),
  ],
  newsletter_20: [
    auditLink("/products/values-discovery-workbook", "CTA: Values Discovery Workbook"),
  ],
  newsletter_22: [
    auditLink("/free/self-esteem-snapshot", "CTA: Retake Self-Esteem Snapshot"),
  ],
  newsletter_23: [
    auditLink("/courses", "CTA: Explore All Courses & Products"),
  ],

  // NEWSLETTER YEAR 2
  newsletter_26: [
    auditLink("/courses?category=relationships", "CTA: Relationship & Boundaries Resources"),
  ],
  newsletter_27: [
    auditLink("/courses/short/negotiating-your-worth", "CTA: Negotiating Your Worth"),
  ],
  newsletter_29: [
    auditLink("/products/30-day-self-worth-challenge", "CTA: 30-Day Self-Worth Challenge"),
  ],
  newsletter_30: [
    auditLink("/courses?category=self_esteem", "CTA: Self-Esteem Courses"),
  ],
  newsletter_31: [
    auditLink("/book?type=free_consultation", "CTA: Book a Free Consultation"),
  ],
  newsletter_32: [
    auditLink("/courses?category=relationships", "CTA: Relationship Courses"),
  ],
  newsletter_34: [
    auditLink("/courses/short/building-self-trust", "CTA: Building Self-Trust"),
  ],
  newsletter_35: [
    auditLink("/free/self-esteem-snapshot", "CTA: Retake Self-Esteem Snapshot"),
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
    auditLink("/courses/the-empowered-empath", "CTA: The Empowered Empath Course"),
  ],
  newsletter_42: [
    auditLink("/products/weekly-self-care-growth-tracker", "CTA: Weekly Self-Care & Growth Tracker"),
  ],
  newsletter_43: [
    auditLink("/packages", "CTA: Complete Confidence Journey Bundle"),
  ],
  newsletter_45: [
    auditLink("/products/self-esteem-starter-kit", "CTA: Self-Esteem Starter Kit"),
  ],
  newsletter_46: [
    auditLink("/free/self-esteem-snapshot", "CTA: Retake Self-Esteem Snapshot"),
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
