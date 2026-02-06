"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AdminRole } from "@/lib/generated/prisma/client";

interface UserFormProps {
  readonly initialData?: {
    id: string;
    name: string | null;
    email: string;
    role: AdminRole;
  };
  readonly onSubmit: (formData: FormData) => Promise<void>;
}

export function UserForm({ initialData, onSubmit }: UserFormProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [role, setRole] = useState<AdminRole>(initialData?.role || "editor");

  const isEditing = !!initialData;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      formData.set("role", role);
      await onSubmit(formData);
      toast.success(isEditing ? "User updated" : "User invited successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
          disabled={isEditing}
        />
        {isEditing && (
          <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="super_admin">Super Admin — Full access</SelectItem>
            <SelectItem value="editor">Editor — Pages, Courses, Testimonials</SelectItem>
            <SelectItem value="marketing">Marketing — Testimonials, Newsletter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEditing ? "Save Changes" : "Send Invite"}
      </Button>

      {!isEditing && (
        <p className="text-xs text-muted-foreground">
          A password reset email will be sent so the user can set their own password.
        </p>
      )}
    </form>
  );
}
