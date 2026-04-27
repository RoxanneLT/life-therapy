"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { OverviewTab } from "./tabs/overview-tab";
import { PersonalTab } from "./tabs/personal-tab";
import { AssessmentTab } from "./tabs/assessment-tab";
import { CommitmentTab } from "./tabs/commitment-tab";
import { SessionsTab } from "./tabs/sessions-tab";
import { PurchasesTab } from "./tabs/purchases-tab";
import { FinancesTab } from "./tabs/finances-tab";
import { CommunicationsTab } from "./tabs/communications-tab";
import { RelationshipsTab } from "./tabs/relationships-tab";
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "personal", label: "Personal" },
  { key: "sessions", label: "Sessions" },
  { key: "finances", label: "Finances" },
  { key: "communications", label: "Communications" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// Sub-sections within Personal tab
const PERSONAL_SECTIONS = [
  { key: "details", label: "Details" },
  { key: "assessment", label: "Assessment" },
  { key: "agreements", label: "Agreements" },
  { key: "relationships", label: "Relationships" },
] as const;

// Sub-sections within Finances tab
const FINANCE_SECTIONS = [
  { key: "billing", label: "Billing" },
  { key: "credits", label: "Credits" },
  { key: "invoices", label: "Invoices" },
  { key: "purchases", label: "Purchases" },
] as const;

interface ClientProfileTabsProps {
  client: Record<string, unknown>;
  activeTab: string;
}

export function ClientProfileTabs({ client, activeTab }: Readonly<ClientProfileTabsProps>) {
  const router = useRouter();
  const pathname = usePathname();

  // Map old tab keys to new structure
  const tabMapping: Record<string, { tab: TabKey; section?: string }> = {
    overview: { tab: "overview" },
    personal: { tab: "personal", section: "details" },
    assessment: { tab: "personal", section: "assessment" },
    commitment: { tab: "personal", section: "agreements" },
    relationships: { tab: "personal", section: "relationships" },
    sessions: { tab: "sessions" },
    purchases: { tab: "finances", section: "purchases" },
    finances: { tab: "finances", section: "billing" },
    communications: { tab: "communications" },
  };

  const mapped = tabMapping[activeTab] || { tab: "overview" };
  const currentTab = mapped.tab;

  const [personalSection, setPersonalSection] = useState(mapped.tab === "personal" ? (mapped.section || "details") : "details");
  const [financeSection, setFinanceSection] = useState(mapped.tab === "finances" ? (mapped.section || "billing") : "billing");

  function handleTabChange(tab: string) {
    const params = tab === "overview" ? "" : `?tab=${tab}`;
    router.push(`${pathname}${params}`);
  }

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b">
        <div className="-mb-px flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "whitespace-nowrap border-b-2 px-5 py-2.5 text-sm font-medium transition-colors",
                currentTab === tab.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-6">
        {currentTab === "overview" && (
          <OverviewTab client={client} />
        )}

        {currentTab === "personal" && (
          <div className="space-y-6">
            {/* Sub-section pills */}
            <div className="flex gap-2">
              {PERSONAL_SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setPersonalSection(s.key)}
                  className={cn(
                    "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                    personalSection === s.key
                      ? "bg-brand-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {personalSection === "details" && <PersonalTab client={client} />}
            {personalSection === "assessment" && <AssessmentTab client={client} />}
            {personalSection === "agreements" && <CommitmentTab client={client} />}
            {personalSection === "relationships" && <RelationshipsTab client={client} />}
          </div>
        )}

        {currentTab === "sessions" && <SessionsTab client={client} />}

        {currentTab === "finances" && (
          <div className="space-y-6">
            {/* Sub-section pills */}
            <div className="flex gap-2">
              {FINANCE_SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setFinanceSection(s.key)}
                  className={cn(
                    "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                    financeSection === s.key
                      ? "bg-brand-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {financeSection === "billing" && <FinancesTab client={client} section="billing" />}
            {financeSection === "credits" && <FinancesTab client={client} section="credits" />}
            {financeSection === "invoices" && <FinancesTab client={client} section="invoices" />}
            {financeSection === "purchases" && <PurchasesTab client={client} />}
          </div>
        )}

        {currentTab === "communications" && <CommunicationsTab client={client} />}
      </div>
    </div>
  );
}
