export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { createContactAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewContactPage() {
  await requireRole("super_admin", "marketing");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contacts
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createContactAction} className="space-y-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  name="gender"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" name="tags" placeholder="e.g. vip, workshop-2026" />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="consentGiven"
                name="consentGiven"
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="consentGiven" className="text-sm font-normal">
                Contact has given marketing email consent
              </Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit">Add Contact</Button>
              <Link href="/admin/contacts">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
