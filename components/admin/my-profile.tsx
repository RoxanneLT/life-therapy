"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MfaSetup } from "@/components/admin/mfa-setup";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { UserCog, KeyRound, ShieldCheck } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  editor: "Editor",
  marketing: "Marketing",
};

interface MyProfileProps {
  readonly profile: {
    readonly name: string | null;
    readonly email: string;
    readonly role: string;
  };
  readonly defaultTab?: "profile" | "password" | "2fa";
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function MyProfile({ profile, defaultTab = "profile" }: MyProfileProps) {
  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="profile">
          <UserCog className="mr-1.5 h-4 w-4" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="password">
          <KeyRound className="mr-1.5 h-4 w-4" />
          Password
        </TabsTrigger>
        <TabsTrigger value="2fa">
          <ShieldCheck className="mr-1.5 h-4 w-4" />
          Two-Factor
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={profile.name || "—"} />
            <Row label="Email" value={profile.email} />
            <Row label="Role" value={ROLE_LABELS[profile.role] ?? profile.role} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="password">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
            <CardDescription>Update your login password.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="2fa">
        <MfaSetup />
      </TabsContent>
    </Tabs>
  );
}
