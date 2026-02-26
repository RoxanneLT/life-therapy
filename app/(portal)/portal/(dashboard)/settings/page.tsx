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
import { RelationshipsTab } from "./tabs/relationships-tab";

const VALID_TABS = ["profile", "assessment", "preferences", "password", "agreements", "relationships"] as const;
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

  // Detect sessions client (for tab filtering)
  const [anyBooking, creditBal] = await Promise.all([
    prisma.booking.findFirst({ where: { studentId: student.id }, select: { id: true } }),
    prisma.sessionCreditBalance.findUnique({ where: { studentId: student.id }, select: { balance: true } }),
  ]);
  const isSessionsClient = !!anyBooking || (creditBal?.balance ?? 0) > 0;

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
  let intake: {
    behaviours: string[];
    feelings: string[];
    symptoms: string[];
    otherBehaviours: string | null;
    otherFeelings: string | null;
    otherSymptoms: string | null;
    additionalNotes: string | null;
    lastEditedBy: string | null;
  } | null = null;

  if (activeTab === "assessment" && isSessionsClient) {
    const raw = await prisma.clientIntake.findUnique({
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
    if (raw) {
      intake = {
        behaviours: raw.behaviours,
        feelings: raw.feelings,
        symptoms: raw.symptoms,
        otherBehaviours: raw.otherBehaviours,
        otherFeelings: raw.otherFeelings,
        otherSymptoms: raw.otherSymptoms,
        additionalNotes: raw.additionalNotes,
        lastEditedBy: raw.lastEditedBy,
      };
    }
  }

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

  // Relationships data (only fetch on that tab)
  let relationshipsData: {
    id: string;
    type: string;
    label: string | null;
    relatedStudentId: string | null;
    relatedFirstName: string;
    relatedLastName: string;
    relatedName: string;
    relatedEmail: string | null;
    isMinor: boolean;
    dateOfBirth: string | null;
    gender: string | null;
  }[] = [];
  let invitesData: {
    id: string;
    fromName: string;
    toName: string;
    toEmail: string;
    relationshipType: string;
    status: string;
    direction: "incoming" | "outgoing";
    createdAt: string;
  }[] = [];
  let billingInfo: { individualBilledTo: string | null; couplesBilledTo: string | null } = {
    individualBilledTo: null,
    couplesBilledTo: null,
  };

  if (activeTab === "relationships" && isSessionsClient) {
    const [relsFrom, relsTo] = await Promise.all([
      prisma.clientRelationship.findMany({
        where: { studentId: student.id, relatedStudentId: { not: null } },
        include: { relatedStudent: { select: { id: true, firstName: true, lastName: true, email: true, supabaseUserId: true, dateOfBirth: true, gender: true } } },
      }),
      prisma.clientRelationship.findMany({
        where: { relatedStudentId: student.id },
        include: { student: { select: { id: true, firstName: true, lastName: true, email: true, supabaseUserId: true, dateOfBirth: true, gender: true } } },
      }),
    ]);

    // Invite queries — gracefully handle if table doesn't exist yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sentInvites: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let receivedInvites: any[] = [];
    try {
      if (prisma.relationshipInvite) {
        [sentInvites, receivedInvites] = await Promise.all([
          prisma.relationshipInvite.findMany({
            where: { fromStudentId: student.id, status: "pending" },
            orderBy: { createdAt: "desc" },
          }),
          prisma.relationshipInvite.findMany({
            where: {
              status: "pending",
              OR: [
                { toStudentId: student.id },
                { toEmail: student.email.toLowerCase() },
              ],
            },
            include: { fromStudent: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
          }),
        ]);
      }
    } catch {
      // Table may not exist yet — invites will be empty
    }

    relationshipsData = [
      ...relsFrom.map((r) => ({
        id: r.id,
        type: r.relationshipType,
        label: r.relationshipLabel,
        relatedStudentId: r.relatedStudent!.id,
        relatedFirstName: r.relatedStudent!.firstName,
        relatedLastName: r.relatedStudent!.lastName || "",
        relatedName: `${r.relatedStudent!.firstName} ${r.relatedStudent!.lastName || ""}`.trim(),
        relatedEmail: r.relatedStudent!.email.endsWith("@noemail.internal") ? null : r.relatedStudent!.email,
        isMinor: !r.relatedStudent!.supabaseUserId,
        dateOfBirth: r.relatedStudent!.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        gender: r.relatedStudent!.gender,
      })),
      ...relsTo
        .filter((r) => !relsFrom.some((f) => f.relatedStudentId === r.studentId))
        .map((r) => ({
          id: r.id,
          type: r.relationshipType === "parent" ? "child" : r.relationshipType === "child" ? "parent" : r.relationshipType,
          label: r.relationshipLabel,
          relatedStudentId: r.student.id,
          relatedFirstName: r.student.firstName,
          relatedLastName: r.student.lastName || "",
          relatedName: `${r.student.firstName} ${r.student.lastName || ""}`.trim(),
          relatedEmail: r.student.email.endsWith("@noemail.internal") ? null : r.student.email,
          isMinor: !r.student.supabaseUserId,
          dateOfBirth: r.student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          gender: r.student.gender,
        })),
    ];

    invitesData = [
      ...sentInvites.map((i) => ({
        id: i.id,
        fromName: `${student.firstName} ${student.lastName || ""}`.trim(),
        toName: i.toName,
        toEmail: i.toEmail,
        relationshipType: i.relationshipType,
        status: i.status,
        direction: "outgoing" as const,
        createdAt: i.createdAt.toISOString(),
      })),
      ...receivedInvites.map((i) => ({
        id: i.id,
        fromName: `${i.fromStudent.firstName} ${i.fromStudent.lastName || ""}`.trim(),
        toName: `${student.firstName} ${student.lastName || ""}`.trim(),
        toEmail: i.toEmail,
        relationshipType: i.relationshipType,
        status: i.status,
        direction: "incoming" as const,
        createdAt: i.createdAt.toISOString(),
      })),
    ];

    // Resolve billing payer names
    const billedToIds = [student.individualBilledToId, student.couplesBilledToId].filter(Boolean) as string[];
    if (billedToIds.length > 0) {
      const billingRels = await prisma.clientRelationship.findMany({
        where: { id: { in: billedToIds } },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          relatedStudent: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      for (const rel of billingRels) {
        // The payer is the other party in the relationship
        const payer = rel.studentId === student.id
          ? rel.relatedStudent
          : rel.student;
        const payerName = payer ? `${payer.firstName} ${payer.lastName || ""}`.trim() : null;
        if (rel.id === student.individualBilledToId) {
          billingInfo.individualBilledTo = payerName;
        }
        if (rel.id === student.couplesBilledToId) {
          billingInfo.couplesBilledTo = payerName;
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Settings</h1>
      <SettingsTabs activeTab={activeTab} isSessionsClient={isSessionsClient} />

      {activeTab === "profile" && <ProfileTab student={serializedStudent} />}
      {activeTab === "assessment" && isSessionsClient && <AssessmentTab intake={intake} />}
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
      {activeTab === "relationships" && isSessionsClient && <RelationshipsTab relationships={relationshipsData} invites={invitesData} billingInfo={billingInfo} />}
    </div>
  );
}
