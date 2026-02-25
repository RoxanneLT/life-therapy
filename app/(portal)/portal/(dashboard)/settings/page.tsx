export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { getActiveDocument, REQUIRED_DOCUMENTS } from "@/lib/legal-documents";
import { SettingsTabs } from "./settings-tabs";
import { ProfileTab } from "./tabs/profile-tab";
import { AssessmentTab } from "./tabs/assessment-tab";
import { PreferencesTab } from "./tabs/preferences-tab";
import { PasswordTab } from "./tabs/password-tab";
import { AgreementsTab } from "./tabs/agreements-tab";

const VALID_TABS = ["profile", "assessment", "preferences", "password", "agreements"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

interface Props {
  readonly searchParams: Promise<{ tab?: string }>;
}

export default async function SettingsPage({ searchParams }: Props) {
  const { student } = await requirePasswordChanged();
  const { tab } = await searchParams;
  const activeTab: SettingsTab = VALID_TABS.includes(tab as SettingsTab)
    ? (tab as SettingsTab)
    : "profile";

  // Profile data
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

  // Assessment data (only fetch on that tab)
  const intake = activeTab === "assessment"
    ? await prisma.clientIntake.findUnique({
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
      })
    : null;

  // Agreements data (only fetch on that tab)
  let agreements: {
    slug: string;
    title: string;
    content: { heading: string; content: string }[];
    version: number;
    acceptedAt: string | null;
  }[] = [];

  if (activeTab === "agreements") {
    const docs = await Promise.all(
      REQUIRED_DOCUMENTS.map(async (slug) => {
        const doc = await getActiveDocument(slug);
        if (!doc) return null;

        const acceptance = await prisma.documentAcceptance.findUnique({
          where: {
            studentId_documentSlug_documentVersion: {
              studentId: student.id,
              documentSlug: slug,
              documentVersion: doc.version,
            },
          },
        });

        return {
          slug: doc.slug,
          title: doc.title,
          content: doc.content as { heading: string; content: string }[],
          version: doc.version,
          acceptedAt: acceptance?.acceptedAt?.toISOString() ?? null,
        };
      }),
    );
    agreements = docs.filter(Boolean) as typeof agreements;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Settings</h1>
      <SettingsTabs activeTab={activeTab} />

      {activeTab === "profile" && <ProfileTab student={serializedStudent} />}
      {activeTab === "assessment" && <AssessmentTab intake={intake} />}
      {activeTab === "preferences" && (
        <PreferencesTab
          newsletterOptIn={student.newsletterOptIn}
          marketingOptIn={student.marketingOptIn}
          smsOptIn={student.smsOptIn}
          sessionReminders={student.sessionReminders}
        />
      )}
      {activeTab === "password" && <PasswordTab email={student.email} />}
      {activeTab === "agreements" && <AgreementsTab agreements={agreements} />}
    </div>
  );
}
