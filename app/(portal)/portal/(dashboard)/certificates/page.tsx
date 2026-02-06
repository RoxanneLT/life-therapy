export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { CertificateCard } from "@/components/portal/certificate-card";
import { Award } from "lucide-react";

export default async function CertificatesPage() {
  const { student } = await requirePasswordChanged();

  const certificates = await prisma.certificate.findMany({
    where: { studentId: student.id },
    include: { course: { select: { title: true } } },
    orderBy: { issuedAt: "desc" },
  });

  const studentName = `${student.firstName} ${student.lastName}`;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">My Certificates</h1>

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Award className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="font-heading text-lg font-semibold">
            No certificates yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete a course to earn your certificate of completion.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <CertificateCard
              key={cert.id}
              certificateNumber={cert.certificateNumber}
              courseTitle={cert.course.title}
              issuedAt={cert.issuedAt}
              studentName={studentName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
