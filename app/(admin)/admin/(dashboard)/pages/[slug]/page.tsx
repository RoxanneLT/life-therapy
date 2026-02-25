export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageEditor } from "./page-editor";

interface Props {
  readonly params: Promise<{ readonly slug: string }>;
  readonly searchParams: Promise<{ tab?: string }>;
}

export default async function PageEditorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tab } = await searchParams;

  const page = await prisma.page.findUnique({
    where: { slug },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!page) {
    notFound();
  }

  // Find SEO record for this page's route
  const seoRoute = slug === "home" ? "/" : `/${slug}`;
  const seo = await prisma.pageSeo.findUnique({
    where: { route: seoRoute },
  });

  const serializedPage = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    isPublished: page.isPublished,
    sections: page.sections.map((s) => ({
      id: s.id,
      sectionType: s.sectionType,
      title: s.title,
      subtitle: s.subtitle,
      content: s.content,
      imageUrl: s.imageUrl,
      imageAlt: s.imageAlt,
      ctaText: s.ctaText,
      ctaLink: s.ctaLink,
      config: (s.config as Record<string, unknown>) || null,
      sortOrder: s.sortOrder,
      isVisible: s.isVisible,
    })),
  };

  const serializedSeo = seo
    ? {
        id: seo.id,
        route: seo.route,
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription,
        ogImageUrl: seo.ogImageUrl,
        keywords: seo.keywords,
      }
    : null;

  return (
    <PageEditor
      initialPage={serializedPage}
      seo={serializedSeo}
      activeTab={tab === "seo" ? "seo" : "content"}
    />
  );
}
