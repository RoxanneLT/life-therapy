// JSON-LD structured data generators for SEO rich results.
// Each returns a plain object to be serialized via <script type="application/ld+json">.

import {
  getSiteSettings,
  getBusinessHours,
  type BusinessHours,
} from "@/lib/settings";
import { getBaseUrl } from "@/lib/get-region";

// ---------- Helper ----------

function hoursToSchema(hours: BusinessHours): object[] {
  const dayMap: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };

  return Object.entries(hours)
    .filter(([, v]) => !v.closed)
    .map(([day, v]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: dayMap[day],
      opens: v.open,
      closes: v.close,
    }));
}

// ---------- Organization (site-wide, root layout) ----------

export async function organizationJsonLd() {
  const settings = await getSiteSettings();
  const baseUrl = await getBaseUrl();

  const sameAs = [
    settings.facebookUrl,
    settings.linkedinUrl,
    settings.instagramUrl,
    settings.tiktokUrl,
    settings.youtubeUrl,
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.siteName || "Life-Therapy",
    url: baseUrl,
    ...(settings.logoUrl ? { logo: settings.logoUrl } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

// ---------- ProfessionalService (home + about pages) ----------

export async function professionalServiceJsonLd() {
  const settings = await getSiteSettings();
  const baseUrl = await getBaseUrl();
  const hours = getBusinessHours(settings);

  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: settings.siteName || "Life-Therapy",
    url: baseUrl,
    ...(settings.logoUrl ? { image: settings.logoUrl } : {}),
    description:
      settings.metaDescription ||
      "Online life coaching, counselling, and self-paced courses.",
    ...(settings.email ? { email: settings.email } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.locationText
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: "South Africa",
            description: settings.locationText,
          },
        }
      : {}),
    openingHoursSpecification: hoursToSchema(hours),
    priceRange: "$$",
  };
}

// ---------- Course (course detail pages) ----------

interface CourseInput {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  priceZarCents: number;
  slug: string;
  level?: string | null;
  hours?: string | null;
}

export async function courseJsonLd(course: CourseInput) {
  const settings = await getSiteSettings();
  const baseUrl = await getBaseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description:
      course.description || `Online course: ${course.title}`,
    url: `${baseUrl}/courses/${course.slug}`,
    ...(course.imageUrl ? { image: course.imageUrl } : {}),
    provider: {
      "@type": "Organization",
      name: settings.siteName || "Life-Therapy",
      url: baseUrl,
    },
    ...(course.level
      ? {
          educationalLevel: course.level,
        }
      : {}),
    ...(course.hours ? { timeRequired: course.hours } : {}),
    offers: {
      "@type": "Offer",
      price: (course.priceZarCents / 100).toFixed(2),
      priceCurrency: "ZAR",
      availability: "https://schema.org/InStock",
      url: `${baseUrl}/courses/${course.slug}`,
    },
  };
}

// ---------- Product (digital product detail pages) ----------

interface ProductInput {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  priceCents: number;
  slug: string;
  category?: string | null;
}

export async function productJsonLd(product: ProductInput) {
  const baseUrl = await getBaseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description:
      product.description || `Digital product: ${product.title}`,
    url: `${baseUrl}/products/${product.slug}`,
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    ...(product.category ? { category: product.category } : {}),
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: "ZAR",
      availability: "https://schema.org/InStock",
      url: `${baseUrl}/products/${product.slug}`,
    },
  };
}

// ---------- BreadcrumbList ----------

interface BreadcrumbItem {
  name: string;
  href: string;
}

export async function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  const baseUrl = await getBaseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.href.startsWith("http")
        ? item.href
        : `${baseUrl}${item.href}`,
    })),
  };
}

// ---------- Render helper ----------

/** Render one or more JSON-LD objects as <script> tags. */
export function JsonLdScript({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
