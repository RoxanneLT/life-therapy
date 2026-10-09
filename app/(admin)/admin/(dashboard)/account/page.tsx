export const dynamic = "force-dynamic";

import { getAuthenticatedAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { MyProfile } from "@/components/admin/my-profile";

const VALID_TABS = ["profile", "password", "2fa"] as const;

export default async function MyProfilePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly tab?: string }>;
}) {
  const { adminUser } = await getAuthenticatedAdmin();
  const { tab } = await searchParams;
  const defaultTab = VALID_TABS.includes(tab as (typeof VALID_TABS)[number])
    ? (tab as (typeof VALID_TABS)[number])
    : "profile";

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your own account — your password and two-factor sign-in. Only you can see this."
      />

      <MyProfile
        profile={{ name: adminUser.name, email: adminUser.email, role: adminUser.role }}
        defaultTab={defaultTab}
      />
    </div>
  );
}
