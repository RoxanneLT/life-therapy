// ============================================================
// Audience Filter Types — used by campaigns + getCampaignRecipients
// ============================================================

export interface AudienceFilters {
  // Basic filters
  source?: string[];             // ["newsletter", "booking", "import", "manual", "website"]
  clientStatus?: string[];       // ["active", "inactive", "potential", "archived"]
  gender?: string[];             // ["male", "female", "non_binary", "prefer_not_to_say"]

  // Age
  ageRange?: {
    min?: number;                // e.g. 18
    max?: number;                // e.g. 65
  };

  // Engagement
  lastLoginRange?: string;       // "7d" | "30d" | "60d" | "90d" | "never"
  lastLoginDirection?: string;   // "within" | "not_within" (within = active, not_within = dormant)

  // Relationship
  relationshipStatus?: string[]; // ["single", "married", "divorced", "in_a_relationship", "its_complicated", "widowed"]
  hasPartnerLinked?: boolean;    // true = has a ClientRelationship with type "partner"

  // Assessment — behaviours, feelings, symptoms from intake
  behaviours?: string[];         // values from BEHAVIOUR_OPTIONS
  feelings?: string[];           // values from FEELING_OPTIONS
  symptoms?: string[];           // values from SYMPTOM_OPTIONS
  assessmentMatchMode?: "any" | "all"; // "any" = OR, "all" = AND (default: "any")

  // Onboarding
  onboardingComplete?: boolean;  // true = onboardingStep >= 3

  // Enrollment
  hasEnrollments?: boolean;      // true = has at least one course enrollment
  hasNoEnrollments?: boolean;    // true = zero enrollments (good for upselling)

  // Tags (legacy support)
  tags?: string[];
}

/**
 * The filters that read a client's assessment answers. Those answers are health information
 * (special personal information under POPIA), so they are clinical: only a role that may read
 * clinical data (lib/clinical-access.ts canSeeClinical) may target by them. A count is not safe
 * to show instead — narrow the filter until it reads 1 and it names a person's mental health.
 * Owner's ruling, 2026-10-10.
 */
const ASSESSMENT_FILTER_KEYS = ["behaviours", "feelings", "symptoms"] as const;

export function usesAssessmentFilters(filters: AudienceFilters | null | undefined): boolean {
  return !!filters && ASSESSMENT_FILTER_KEYS.some((k) => (filters[k]?.length ?? 0) > 0);
}

export function withoutAssessmentFilters(filters: AudienceFilters | undefined): AudienceFilters | undefined {
  if (!filters) return filters;
  const { behaviours: _b, feelings: _f, symptoms: _s, assessmentMatchMode: _m, ...rest } = filters;
  return rest;
}

// Options for select-style filters
export const CLIENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "potential", label: "Potential" },
  { value: "archived", label: "Archived" },
];

export const SOURCE_OPTIONS = [
  { value: "newsletter", label: "Newsletter" },
  { value: "booking", label: "Booking" },
  { value: "student", label: "Student" },
  { value: "import", label: "Import" },
  { value: "manual", label: "Manual" },
  { value: "website", label: "Website" },
];

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-Binary" },
  { value: "prefer_not_to_say", label: "Prefer Not to Say" },
];

export const RELATIONSHIP_STATUS_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "in_a_relationship", label: "In a Relationship" },
  { value: "its_complicated", label: "It's Complicated" },
  { value: "widowed", label: "Widowed" },
];

export const LAST_LOGIN_OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
  { value: "90d", label: "90 days" },
  { value: "never", label: "Never logged in" },
];

export const AGE_PRESETS = [
  { label: "Under 18", min: undefined, max: 17 },
  { label: "18–25", min: 18, max: 25 },
  { label: "26–35", min: 26, max: 35 },
  { label: "36–50", min: 36, max: 50 },
  { label: "Over 50", min: 50, max: undefined },
];
