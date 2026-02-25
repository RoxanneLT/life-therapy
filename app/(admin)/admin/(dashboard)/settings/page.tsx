export const dynamic = "force-dynamic";

import { getSiteSettings } from "@/lib/settings";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/admin/settings-form";
import { FinanceSettingsForm } from "@/components/admin/finance-settings-form";
import { SettingsTabs } from "./settings-tabs";
import { UsersPanel } from "./users-panel";
import {
  getEffectiveBillingDate,
  getEffectiveDueDate,
  getReminderDate,
  getOverdueDate,
} from "@/lib/billing";
import {
  getActiveDocument,
  getDocumentHistory,
  getAcceptanceStats,
  REQUIRED_DOCUMENTS,
  type LegalDocumentSlug,
} from "@/lib/legal-documents";
import { LegalDocumentsClient } from "../legal-documents/legal-documents-client";
import { WhatsAppPanel } from "./whatsapp-panel";
import { format } from "date-fns";

const VALID_TABS = ["settings", "users", "finance", "legal", "whatsapp"] as const;
type SettingsTab = (typeof VALID_TABS)[number];
const ALL_LEGAL_SLUGS: LegalDocumentSlug[] = ["commitment", "terms", "privacy"];

interface Props {
  readonly searchParams: Promise<{ tab?: string }>;
}

export default async function AdminSettingsPage({ searchParams }: Props) {
  const { adminUser } = await requireRole("super_admin");
  const { tab } = await searchParams;
  const activeTab: SettingsTab = VALID_TABS.includes(tab as SettingsTab)
    ? (tab as SettingsTab)
    : "settings";

  const settings = await getSiteSettings();

  const secretStatus = {
    msGraphConfigured: !!(process.env.MS_GRAPH_TENANT_ID && process.env.MS_GRAPH_CLIENT_SECRET),
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    paystackConfigured: !!process.env.PAYSTACK_SECRET_KEY,
    resendConfigured: !!process.env.RESEND_API_KEY,
  };

  // Only fetch users if on the users tab
  const users = activeTab === "users"
    ? await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } })
    : [];

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  // Finance tab data
  let nextDates: { billing: string; due: string; reminder: string; overdue: string } | null = null;
  if (activeTab === "finance") {
    const now = new Date();
    const nextMonth = now.getMonth() + 2;
    const year = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const month = nextMonth > 12 ? 1 : nextMonth;
    const billingDate = getEffectiveBillingDate(year, month, settings.postpaidBillingDay);
    const dueDate = getEffectiveDueDate(year, month, settings.postpaidDueDay);
    const reminderDate = getReminderDate(dueDate);
    const overdueDate = getOverdueDate(dueDate);
    nextDates = {
      billing: format(billingDate, "EEE d MMM yyyy"),
      due: format(dueDate, "EEE d MMM yyyy"),
      reminder: format(reminderDate, "EEE d MMM yyyy"),
      overdue: format(overdueDate, "EEE d MMM yyyy"),
    };
  }

  // Legal tab data
  let legalDocuments: Awaited<ReturnType<typeof loadLegalDocuments>> | null = null;
  if (activeTab === "legal") {
    legalDocuments = await loadLegalDocuments();
  }

  return (
    <div className="space-y-6">
      <SettingsTabs activeTab={activeTab} />
      {activeTab === "settings" && (
        <SettingsForm initialSettings={settings} secretStatus={secretStatus} />
      )}
      {activeTab === "users" && <UsersPanel users={serializedUsers} />}
      {activeTab === "finance" && nextDates && (
        <FinanceSettingsForm initialSettings={settings} nextDates={nextDates} />
      )}
      {activeTab === "whatsapp" && (
        <WhatsAppPanel
          initialSettings={settings}
          whatsappTokenSet={!!process.env.WHATSAPP_ACCESS_TOKEN}
        />
      )}
      {activeTab === "legal" && legalDocuments && (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-xl font-bold">Legal Documents</h2>
            <p className="text-sm text-muted-foreground">
              Manage commitment agreements, terms &amp; conditions, and privacy
              policy. Publishing a new version will require active clients to
              re-accept.
            </p>
          </div>
          <LegalDocumentsClient
            documents={legalDocuments}
            adminUserId={adminUser.id}
          />
        </div>
      )}
    </div>
  );
}

async function loadLegalDocuments() {
  return Promise.all(
    ALL_LEGAL_SLUGS.map(async (slug) => {
      const active = await getActiveDocument(slug);
      const history = await getDocumentHistory(slug);
      const stats = active
        ? await getAcceptanceStats(slug, active.version)
        : null;

      return {
        slug,
        active: active
          ? {
              id: active.id,
              title: active.title,
              content: active.content as { heading: string; content: string }[],
              version: active.version,
              publishedAt: active.publishedAt?.toISOString() ?? null,
              changeSummary: active.changeSummary,
            }
          : null,
        stats,
        requiresAcceptance: REQUIRED_DOCUMENTS.includes(slug),
        history: history.map((h) => ({
          id: h.id,
          version: h.version,
          title: h.title,
          content: h.content as { heading: string; content: string }[],
          changeSummary: h.changeSummary,
          publishedAt: h.publishedAt?.toISOString() ?? null,
          isActive: h.isActive,
          acceptanceCount: h._count.acceptances,
        })),
      };
    }),
  );
}
