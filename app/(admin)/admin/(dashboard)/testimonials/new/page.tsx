export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { TestimonialForm } from "@/components/admin/testimonial-form";
import { createTestimonial } from "../actions";
import { shortClientName } from "@/lib/client-display";

export default async function NewTestimonialPage() {
  const clients = await prisma.student.findMany({
    where: { clientStatus: { not: "potential" } },
    select: { firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const clientOptions = clients.map((c) => ({
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    fillName: shortClientName(c.firstName, c.lastName),
  }));

  return (
    <TestimonialForm
      onSubmit={createTestimonial}
      clients={clientOptions}
      headerTitle="Add Testimonial"
      headerDescription="Add a new client testimonial."
      backHref="/admin/testimonials"
      backLabel="Testimonials"
    />
  );
}
