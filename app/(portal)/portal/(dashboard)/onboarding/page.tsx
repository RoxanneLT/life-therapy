export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/portal/onboarding-wizard";
import { format } from "date-fns";
import { getActiveDocument, ONBOARDING_DOCUMENTS } from "@/lib/legal-documents";

interface Props {
  readonly searchParams: Promise<{ step?: string }>;
}

export default async function OnboardingPage({ searchParams }: Props) {
  const { student } = await requirePasswordChanged();
  const { step } = await searchParams;

  if (student.onboardingStep >= 3) {
    redirect("/portal");
  }

  // Fetch intake data and legal documents in parallel
  const [intake, ...legalDocs] = await Promise.all([
    prisma.clientIntake.findUnique({
      where: { studentId: student.id },
      select: {
        behaviours: true,
        feelings: true,
        symptoms: true,
        otherBehaviours: true,
        otherFeelings: true,
        otherSymptoms: true,
        additionalNotes: true,
        lastEditedBy: true,
      },
    }),
    ...ONBOARDING_DOCUMENTS.map((slug) => getActiveDocument(slug)),
  ]);

  // Serialize documents for the client component
  const onboardingDocuments = legalDocs
    .filter(Boolean)
    .map((doc) => ({
      slug: doc!.slug,
      title: doc!.title,
      content: doc!.content as { heading: string; content: string }[],
      version: doc!.version,
    }));

  const serializedStudent = {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    phone: student.phone,
    smsOptIn: student.smsOptIn,
    dateOfBirth: student.dateOfBirth ? format(new Date(student.dateOfBirth), "yyyy-MM-dd") : null,
    gender: student.gender,
    address: student.address,
    relationshipStatus: student.relationshipStatus,
    emergencyContact: student.emergencyContact,
    referralSource: student.referralSource,
    referralDetail: student.referralDetail,
    onboardingStep: student.onboardingStep,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl font-bold">Complete Your Profile</h1>
      <OnboardingWizard
        student={serializedStudent}
        intake={intake}
        onboardingDocuments={onboardingDocuments}
        initialStep={step ? parseInt(step, 10) : undefined}
      />
    </div>
  );
}
