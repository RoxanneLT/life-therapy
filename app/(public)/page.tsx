export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";

export const revalidate = 60;

export default async function HomePage() {
  const page = await prisma.page.findUnique({
    where: { slug: "home" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });

  if (!page || !page.isPublished) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-brand-600">
            Life-Therapy
          </h1>
          <p className="mt-2 text-muted-foreground">
            Coming soon. Content is being prepared.
          </p>
        </div>
      </div>
    );
  }

  return <SectionRenderer sections={page.sections} />;
}
