// Shared metadata helper — builds full OG + Twitter + canonical for any page.
// Fallback chain: PageSeo row → input defaults → SiteSetting → hardcoded.

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/get-region";
import { getSiteSettings } from "@/lib/settings";
import type { Metadata } from "next";

// ---------- PageSeo Cache ----------

const getCachedPageSeo = unstable_cache(
  async (route: string) => {
    return prisma.pageSeo.findUnique({ where: { route } });
  },
  ["page-seo"],
  { revalidate: 3600, tags: ["page-seo"] }
);

/** Fetch PageSeo row for a static route. Returns null if not found. */
export async function getPageSeo(route: string) {
  return getCachedPageSeo(route);
}

// ---------- buildMetadata ----------

interface MetadataInput {
  title?: string | null;
  description?: string | null;
  ogImageUrl?: string | null;
  route: string;
  noIndex?: boolean;
  type?: "website" | "article";
}

/**
 * Build a complete Next.js Metadata object with OG, Twitter, and canonical.
 *
 * OG image URLs: relative paths (e.g. "/images/hero.jpg") are resolved
 * automatically by Next.js via metadataBase set in root layout.
 */
export async function buildMetadata(input: MetadataInput): Promise<Metadata> {
  const baseUrl = await getBaseUrl();
  const settings = await getSiteSettings();

  const title =
    input.title || settings.metaTitle || "Life-Therapy";
  const description =
    input.description ||
    settings.metaDescription ||
    "Transform your life with Roxanne Bouwer. Qualified life coach, counsellor & NLP practitioner offering online courses and 1:1 sessions.";
  const ogImage =
    input.ogImageUrl || settings.ogImageUrl || "/images/hero-home.jpg";
  const url = `${baseUrl}${input.route}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: settings.siteName || "Life-Therapy",
      type: input.type ?? "website",
      locale: "en_ZA",
      images: [{ url: ogImage, width: 1200, height: 630, alt: String(title) }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    ...(input.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

// ---------- Convenience: static page metadata ----------

/**
 * Generate metadata for a static page by reading from PageSeo with hardcoded fallbacks.
 * Usage: `return buildStaticPageMetadata("/about", "About Roxanne Bouwer", "Meet Roxanne...", "/images/roxanne-portrait.jpg");`
 */
export async function buildStaticPageMetadata(
  route: string,
  fallbackTitle: string,
  fallbackDescription: string,
  fallbackOgImage: string
): Promise<Metadata> {
  const seo = await getPageSeo(route);
  return buildMetadata({
    title: seo?.metaTitle ?? fallbackTitle,
    description: seo?.metaDescription ?? fallbackDescription,
    ogImageUrl: seo?.ogImageUrl ?? fallbackOgImage,
    route,
  });
}
