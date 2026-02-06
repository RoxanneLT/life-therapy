import { requireRole } from "@/lib/auth";
import { UserForm } from "@/components/admin/user-form";
import { inviteUser } from "../actions";

export default async function NewUserPage() {
  await requireRole("super_admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Invite User</h1>
        <p className="text-sm text-muted-foreground">
          Add a new admin user. They will receive an email to set their password.
        </p>
      </div>
      <UserForm onSubmit={inviteUser} />
    </div>
  );
}
