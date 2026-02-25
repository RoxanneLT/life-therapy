"use client";

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
  { key: "assessment", label: "Assessment" },
  { key: "commitment", label: "Agreements" },
  { key: "sessions", label: "Sessions" },
  { key: "purchases", label: "Purchases" },
  { key: "finances", label: "Finances" },
  { key: "relationships", label: "Relationships" },
  { key: "communications", label: "Communications" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface ClientProfileTabsProps {
  client: Record<string, unknown>;
  activeTab: string;
  insights?: Record<string, unknown> | null;
}

export function ClientProfileTabs({ client, activeTab, insights }: ClientProfileTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleTabChange(tab: string) {
    const params = tab === "overview" ? "" : `?tab=${tab}`;
    router.push(`${pathname}${params}`);
  }

  const currentTab = (TABS.some((t) => t.key === activeTab) ? activeTab : "overview") as TabKey;

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b">
        <div className="-mb-px flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
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
          <OverviewTab client={client} insights={insights as never} />
        )}
        {currentTab === "personal" && <PersonalTab client={client} />}
        {currentTab === "assessment" && <AssessmentTab client={client} />}
        {currentTab === "commitment" && <CommitmentTab client={client} />}
        {currentTab === "sessions" && <SessionsTab client={client} />}
        {currentTab === "purchases" && <PurchasesTab client={client} />}
        {currentTab === "finances" && <FinancesTab client={client} />}
        {currentTab === "relationships" && <RelationshipsTab client={client} />}
        {currentTab === "communications" && <CommunicationsTab client={client} />}
      </div>
    </div>
  );
}
