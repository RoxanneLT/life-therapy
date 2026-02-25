export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { student } = await requirePasswordChanged();
  const params = await searchParams;

  const intake = await prisma.clientIntake.findUnique({
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
  });

  const serializedStudent = {
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    phone: student.phone,
    dateOfBirth: student.dateOfBirth
      ? student.dateOfBirth.toISOString().split("T")[0]
      : null,
    gender: student.gender,
    address: student.address,
    relationshipStatus: student.relationshipStatus,
    emergencyContact: student.emergencyContact,
    referralSource: student.referralSource,
    referralDetail: student.referralDetail,
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">My Profile</h1>
      <ProfileClient
        student={serializedStudent}
        intake={intake}
        activeTab={params.tab === "assessment" ? "assessment" : "personal"}
      />
    </div>
  );
}
