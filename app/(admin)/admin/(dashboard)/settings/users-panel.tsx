"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, Key, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  editor: "Editor",
  marketing: "Marketing",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  editor: "secondary",
  marketing: "outline",
};

const SECTIONS = [
  { id: "all", label: "All Users", icon: Users },
  { id: "roles", label: "Role Overview", icon: Shield },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

interface UsersPanelProps {
  readonly users: UserRow[];
}

export function UsersPanel({ users }: UsersPanelProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("all");

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-6">
      {/* Sidebar */}
      <div className="flex w-48 shrink-0 flex-col">
        <div className="mb-5">
          <h2 className="font-heading text-xl font-bold">Users</h2>
          <p className="text-xs text-muted-foreground">
            {users.length} admin user{users.length === 1 ? "" : "s"}
          </p>
        </div>

        <nav className="flex-1 space-y-0.5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  activeSection === section.id
                    ? "bg-brand-50 text-brand-700"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t pt-4">
          <Button asChild className="w-full">
            <Link href="/admin/users/new">
              <Plus className="mr-2 h-4 w-4" />
              Invite User
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/admin/users/change-password">
              <Key className="mr-2 h-4 w-4" />
              Change Password
            </Link>
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="min-w-0 flex-1 overflow-y-auto pr-1">
        {activeSection === "all" && (
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                Manage admin users and their roles
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Name</TableHead>
                    <TableHead className="px-4">Email</TableHead>
                    <TableHead className="px-4">Role</TableHead>
                    <TableHead className="px-4">Joined</TableHead>
                    <TableHead className="w-12 px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="px-4 font-medium">
                        {user.name || "—"}
                      </TableCell>
                      <TableCell className="px-4">{user.email}</TableCell>
                      <TableCell className="px-4">
                        <Badge variant={ROLE_VARIANTS[user.role] || "secondary"}>
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-4">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/users/${user.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeSection === "roles" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Role Overview</CardTitle>
                <CardDescription>
                  Distribution of admin roles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <div
                    key={role}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={ROLE_VARIANTS[role] || "secondary"}>
                        {label}
                      </Badge>
                    </div>
                    <span className="text-sm font-medium">
                      {roleCounts[role] || 0} user{(roleCounts[role] || 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Role Permissions</CardTitle>
                <CardDescription>
                  What each role can access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Super Admin</p>
                  <p className="text-xs text-muted-foreground">
                    Full access — settings, users, billing, legal documents, and all client data
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Editor</p>
                  <p className="text-xs text-muted-foreground">
                    Manage clients, sessions, blog content, and view reports
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Marketing</p>
                  <p className="text-xs text-muted-foreground">
                    Manage blog content and newsletter subscribers
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
