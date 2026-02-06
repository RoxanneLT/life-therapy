export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { UserForm } from "@/components/admin/user-form";
import { updateUser, deleteUser } from "../actions";
import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";

interface Props {
  readonly params: { readonly id: string };
}

export default async function EditUserPage({ params }: Props) {
  const { adminUser: currentAdmin } = await requireRole("super_admin");

  const user = await prisma.adminUser.findUnique({
    where: { id: params.id },
  });

  if (!user) {
    notFound();
  }

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateUser(params.id, formData);
  }

  async function handleDelete() {
    "use server";
    await deleteUser(params.id);
  }

  const isSelf = currentAdmin.id === user.id;

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
      />
    </div>
  );
}
