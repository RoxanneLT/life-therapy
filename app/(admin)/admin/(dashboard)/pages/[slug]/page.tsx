export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageEditor } from "./page-editor";

interface Props {
  readonly params: { readonly slug: string };
}

export default async function PageEditorPage({ params }: Props) {
  const page = await prisma.page.findUnique({
    where: { slug: params.slug },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!page) {
    notFound();
  }

  // Serialize for client component (convert Dates, Decimals, etc.)
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

  return <PageEditor initialPage={serializedPage} />;
}
