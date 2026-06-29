export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersPanel } from "../users-panel";

export default async function TeamSettingsPage() {
  await requireRole("super_admin");

  const users = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <UsersPanel
      users={serializedUsers}
      embedded
      headerTitle="Team"
      headerDescription="Admin users and their roles."
    />
  );
}
