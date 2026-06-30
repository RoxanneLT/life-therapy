export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { UserForm } from "@/components/admin/user-form";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateUser, deleteUser } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import { Trash2, ShieldCheck } from "lucide-react";
import { ResetMfaButton } from "./reset-mfa-button";
import { SendResetButton } from "./send-reset-button";

interface Props {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function EditUserPage({ params }: Props) {
  const { id } = await params;
  const { adminUser: currentAdmin } = await requireRole("super_admin");

  const user = await prisma.adminUser.findUnique({
    where: { id },
  });

  if (!user) {
    notFound();
  }

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateUser(id, formData);
  }

  async function handleDelete() {
    "use server";
    await deleteUser(id);
  }

  const isSelf = currentAdmin.id === user.id;

  // For another admin we can only show 2FA status + reset it — enrolment is
  // self-only (it needs that person's own session). Look the status up via the
  // admin API.
  let factorCount = 0;
  if (!isSelf) {
    try {
      const { data } = await supabaseAdmin.auth.admin.mfa.listFactors({
        userId: user.supabaseUserId,
      });
      factorCount = (data?.factors ?? []).length;
    } catch {
      factorCount = 0;
    }
  }

  let otherMfaStatus = "Not set up yet — they'll be prompted to add 2FA on next sign-in.";
  if (factorCount > 0) {
    otherMfaStatus = `Enabled — ${factorCount} ${factorCount === 1 ? "method" : "methods"} on file.`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Edit User</h1>
          <p className="text-sm text-muted-foreground">
            Update {user.name || user.email}&apos;s details and role.
          </p>
        </div>
        {!isSelf && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {user.name || user.email}&apos;s account.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <form action={handleDelete}>
                  <AlertDialogAction type="submit" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <UserForm
        initialData={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }}
        onSubmit={handleUpdate}
        lockRole={isSelf}
      />

      {/* Security — 2FA is bound to the user, so it lives on their record. */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Security</h2>
        </div>

        {isSelf ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your security</CardTitle>
              <CardDescription>
                Manage your own password and two-factor sign-in in your profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/account">Go to My Profile →</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Password</CardTitle>
                <CardDescription>Email this admin a secure reset link.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    You can&apos;t set someone else&apos;s password directly. Send a reset link
                    and they&apos;ll choose a new one.
                  </p>
                  <SendResetButton adminUserId={user.id} email={user.email} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
                <CardDescription>{otherMfaStatus}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    You can&apos;t set up 2FA for someone else. If they&apos;ve lost their
                    authenticator or passkey, reset it so they can re-enrol on next sign-in.
                  </p>
                  <ResetMfaButton adminUserId={user.id} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
