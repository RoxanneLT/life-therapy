import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { UserForm } from "@/components/admin/user-form";
import { inviteUser } from "../actions";

export default async function NewUserPage() {
  await requireAccess("/admin/users");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invite User"
        description="Add a new admin user. They will receive an email to set their password."
      />
      <UserForm onSubmit={inviteUser} />
    </div>
  );
}
