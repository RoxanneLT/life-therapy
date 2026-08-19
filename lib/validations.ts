import { z } from "zod";

/**
 * @queued Adopt at the call site rather than delete — see the note in knip.jsonc.
 * The path this describes DOES validate today, by hand, beside this schema. Two
 * expressions of one rule, and this is the better one; adopting it changes
 * validation behaviour on an admin form, so it is a decided change of its own.
 */
export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export const pageSectionSchema = z.object({
  sectionType: z.enum([
    "hero",
    "text",
    "image_text",
    "cta",
    "testimonial_carousel",
    "course_grid",
    "course_catalog",
    "package_grid",
    "features",
    "pricing",
    "steps",
    "faq",
  ]),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  config: z.any().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
});

export const courseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  subtitle: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.coerce.number().int().min(0).default(0),
  priceUsd: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  priceEur: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  priceGbp: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  category: z.string().optional(),
  // modulesCount and hours are auto-computed by recalculateCourseStats
  level: z.string().optional(),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  previewVideoUrl: z.string().optional().or(z.literal("")),
  facilitatorScript: z.string().optional(),
  relatedCourseIds: z.any().optional(),
  metaTitle: z.string().max(70, "Keep under 70 characters").optional().or(z.literal("")).transform((v) => v || undefined),
  metaDescription: z.string().max(320, "Keep under 320 characters").optional().or(z.literal("")).transform((v) => v || undefined),
});

export const testimonialSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(),
  location: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  imageUrl: z.string().optional(),
  serviceType: z.string().default("session"),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

/**
 * @queued Adopt at the call site rather than delete — see the note in knip.jsonc.
 * The path this describes DOES validate today, by hand, beside this schema. Two
 * expressions of one rule, and this is the better one; adopting it changes
 * validation behaviour on an admin form, so it is a decided change of its own.
 */
export const siteSettingsSchema = z.object({
  // Branding
  siteName: z.string().min(1, "Site name is required"),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  // Contact
  email: z.email().optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  businessHours: z.any().optional(),
  locationText: z.string().optional(),
  // Social Links
  facebookUrl: z.url().optional().or(z.literal("")),
  linkedinUrl: z.url().optional().or(z.literal("")),
  instagramUrl: z.url().optional().or(z.literal("")),
  tiktokUrl: z.url().optional().or(z.literal("")),
  youtubeUrl: z.url().optional().or(z.literal("")),
  // SEO
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),
  googleAnalyticsId: z.string().optional(),
  // Email (SMTP)
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().optional().or(z.literal("")),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFromName: z.string().optional(),
  smtpFromEmail: z.email().optional().or(z.literal("")),
  // Footer
  copyrightText: z.string().optional(),
  footerTagline: z.string().optional(),
  // Session Pricing (all currencies)
  sessionPriceIndividualZar: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  sessionPriceIndividualUsd: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  sessionPriceIndividualEur: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  sessionPriceIndividualGbp: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  sessionPriceCouplesZar: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  sessionPriceCouplesUsd: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  sessionPriceCouplesEur: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  sessionPriceCouplesGbp: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
});

export const bookingFormSchema = z.object({
  sessionType: z.enum(["free_consultation", "individual", "couples"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  clientName: z.string().min(2, "Name is required"),
  clientEmail: z.email("Valid email is required"),
  clientPhone: z.string().optional(),
  clientNotes: z.string().max(1000).optional(),
});

/**
 * @queued Adopt at the call site rather than delete — see the note in knip.jsonc.
 * The path this describes DOES validate today, by hand, beside this schema. Two
 * expressions of one rule, and this is the better one; adopting it changes
 * validation behaviour on an admin form, so it is a decided change of its own.
 */
export const availabilityOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isBlocked: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  reason: z.string().max(200).optional(),
});

/**
 * @queued Adopt at the call site rather than delete — see the note in knip.jsonc.
 * The path this describes DOES validate today, by hand, beside this schema. Two
 * expressions of one rule, and this is the better one; adopting it changes
 * validation behaviour on an admin form, so it is a decided change of its own.
 */
export const bookingSettingsSchema = z.object({
  bookingMaxAdvanceDays: z.coerce.number().int().min(1).max(365).default(60),
  bookingMinNoticeHours: z.coerce.number().int().min(0).max(168).default(24),
  bookingBufferMinutes: z.coerce.number().int().min(0).max(120).default(15),
  bookingEnabled: z.boolean().default(false),
  msGraphTenantId: z.string().optional().or(z.literal("")),
  msGraphClientId: z.string().optional().or(z.literal("")),
  msGraphClientSecret: z.string().optional().or(z.literal("")),
  msGraphUserEmail: z.email().optional().or(z.literal("")),
});

// ============================================================
// LMS: Module / Lecture / Quiz
// ============================================================
export const moduleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  // Standalone selling fields (short courses)
  standaloneSlug: z.string().optional().transform((v) => v || undefined),
  standaloneTitle: z.string().optional().transform((v) => v || undefined),
  standaloneDescription: z.string().optional(),
  standaloneImageUrl: z.string().optional().transform((v) => v || undefined),
  standalonePrice: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  standalonePriceUsd: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  standalonePriceEur: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  standalonePriceGbp: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  isStandalonePublished: z.boolean().default(false),
  standaloneCategory: z.string().optional().transform((v) => v || undefined),
  // Preview video & facilitator
  previewVideoUrl: z.string().optional().transform((v) => v || undefined),
  facilitatorScript: z.string().optional(),
});

export const lectureSchema = z.object({
  title: z.string().min(1, "Title is required"),
  lectureType: z.enum(["video", "text", "quiz"]),
  videoUrl: z.string().optional().or(z.literal("")),
  textContent: z.string().optional(),
  worksheetUrl: z.string().optional().or(z.literal("")),
  durationSeconds: z.coerce.number().int().min(0).optional(),
  isPreview: z.boolean().default(false),
  context: z.enum(["both", "course_only", "standalone_only"]).default("both"),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

/**
 * @queued Adopt at the call site rather than delete — see the note in knip.jsonc.
 * The path this describes DOES validate today, by hand, beside this schema. Two
 * expressions of one rule, and this is the better one; adopting it changes
 * validation behaviour on an admin form, so it is a decided change of its own.
 */
export const quizQuestionSchema = z.object({
  questionType: z.enum(["multiple_choice", "true_false", "reflection"]),
  questionText: z.string().min(1, "Question text is required"),
  options: z.any().optional(),
  explanation: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ============================================================
// E-Commerce: Coupons / Credit Packs
// ============================================================
/**
 * @queued Adopt at the call site rather than delete — see the note in knip.jsonc.
 * The path this describes DOES validate today, by hand, beside this schema. Two
 * expressions of one rule, and this is the better one; adopting it changes
 * validation behaviour on an admin form, so it is a decided change of its own.
 */
export const couponSchema = z.object({
  code: z.string().min(1, "Code is required").transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed_amount"]),
  value: z.coerce.number().int().min(1, "Value must be at least 1"),
  appliesToAll: z.boolean().default(true),
  courseIds: z.any().optional(),
  packageIds: z.any().optional(),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxUsesPerUser: z.coerce.number().int().min(1).default(1),
  minOrderCents: z.coerce.number().int().min(0).optional().or(z.literal("")),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const packageSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  priceCents: z.coerce.number().int().min(0, "Price is required"),
  priceCentsUsd: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  priceCentsEur: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  priceCentsGbp: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  credits: z.coerce.number().int().min(0).default(0),
  courseSlots: z.coerce.number().int().min(0).default(0),
  digitalProductSlots: z.coerce.number().int().min(0).default(0),
  isFixed: z.boolean().default(false),
  fixedCourseIds: z.array(z.string()).default([]),
  fixedModuleIds: z.array(z.string()).default([]),
  fixedDigitalProductIds: z.array(z.string()).default([]),
  category: z.string().optional().transform((v) => v || undefined),
  isPublished: z.boolean().default(false),
  metaTitle: z.string().max(70, "Keep under 70 characters").optional().or(z.literal("")).transform((v) => v || undefined),
  metaDescription: z.string().max(320, "Keep under 320 characters").optional().or(z.literal("")).transform((v) => v || undefined),
});

export const digitalProductSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  fileUrl: z.string().min(1, "File is required"),
  fileName: z.string().optional(),
  fileSizeBytes: z.coerce.number().int().optional(),
  priceCents: z.coerce.number().int().min(0, "Price is required"),
  priceCentsUsd: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  priceCentsEur: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  priceCentsGbp: z.union([z.coerce.number().int().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? undefined : v)),
  category: z.string().optional().transform((v) => v || undefined),
  isPublished: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  metaTitle: z.string().max(70, "Keep under 70 characters").optional().or(z.literal("")).transform((v) => v || undefined),
  metaDescription: z.string().max(320, "Keep under 320 characters").optional().or(z.literal("")).transform((v) => v || undefined),
});

// ============================================================
// SEO: PageSeo
// ============================================================
export const pageSeoSchema = z.object({
  metaTitle: z.string().max(70, "Keep under 70 characters").optional().or(z.literal("")),
  metaDescription: z.string().max(320, "Keep under 320 characters").optional().or(z.literal("")),
  ogImageUrl: z.string().optional().or(z.literal("")),
  keywords: z.string().optional().or(z.literal("")),
});

// ============================================================
// Student Registration
// ============================================================
export const studentRegisterSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * @queued Adopt at the call site rather than delete — see the note in knip.jsonc.
 * The path this describes DOES validate today, by hand, beside this schema. Two
 * expressions of one rule, and this is the better one; adopting it changes
 * validation behaviour on an admin form, so it is a decided change of its own.
 */
export const studentLoginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ============================================================
// Type exports
// ============================================================
// Seventeen `z.infer<typeof xSchema>` aliases lived here and not one was imported. They
// were removed on 2026-08-19 rather than kept "for documentation": a derived alias
// documents nothing the schema above it does not already say, and it is one line to
// write at the point somebody actually needs it —
//
//   type CouponInput = z.infer<typeof couponSchema>;
//
// Nothing is lost, and seventeen entries stop appearing in every dead-code report.
// Noise that never shrinks is how a report stops being read.
