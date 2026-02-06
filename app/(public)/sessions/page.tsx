export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "1:1 Online Sessions",
  description:
    "Personalised online life coaching and counselling sessions with Roxanne Bouwer. Secure video calls from anywhere in the world.",
};

export const revalidate = 60;

export default async function SessionsPage() {
  const page = await prisma.page.findUnique({
    where: { slug: "sessions" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });

  if (!page || !page.isPublished) {
    notFound();
  }

  return <SectionRenderer sections={page.sections} />;
}
