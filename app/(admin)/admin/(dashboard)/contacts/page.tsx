export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Upload, Users } from "lucide-react";
import { format } from "date-fns";

const SOURCE_LABELS: Record<string, string> = {
  newsletter: "Newsletter",
  booking: "Booking",
  student: "Student",
  import: "Import",
  manual: "Manual",
};

const SOURCE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  newsletter: "default",
  booking: "secondary",
  student: "outline",
  import: "outline",
  manual: "outline",
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; status?: string; q?: string }>;
}) {
  await requireRole("super_admin", "marketing");
  const params = await searchParams;

  const where: Record<string, unknown> = {};

  if (params.source) {
    where.source = params.source;
  }

  if (params.status === "subscribed") {
    where.emailOptOut = false;
    where.consentGiven = true;
  } else if (params.status === "unsubscribed") {
    where.emailOptOut = true;
  }

  if (params.q) {
    where.OR = [
      { email: { contains: params.q, mode: "insensitive" } },
      { firstName: { contains: params.q, mode: "insensitive" } },
      { lastName: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [contacts, totalCount, subscribedCount] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.contact.count(),
    prisma.contact.count({ where: { emailOptOut: false, consentGiven: true } }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} total &middot; {subscribedCount} subscribed
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/contacts/import">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href="/admin/contacts/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/contacts">
          <Badge variant={!params.source && !params.status ? "default" : "outline"} className="cursor-pointer">
            All
          </Badge>
        </Link>
        {Object.entries(SOURCE_LABELS).map(([key, label]) => (
          <Link key={key} href={`/admin/contacts?source=${key}`}>
            <Badge variant={params.source === key ? "default" : "outline"} className="cursor-pointer">
              {label}
            </Badge>
          </Link>
        ))}
        <span className="mx-1 border-l" />
        <Link href="/admin/contacts?status=subscribed">
          <Badge variant={params.status === "subscribed" ? "default" : "outline"} className="cursor-pointer">
            Subscribed
          </Badge>
        </Link>
        <Link href="/admin/contacts?status=unsubscribed">
          <Badge variant={params.status === "unsubscribed" ? "destructive" : "outline"} className="cursor-pointer">
            Unsubscribed
          </Badge>
        </Link>
      </div>

      {/* Search */}
      <form className="mb-4">
        <input
          type="text"
          name="q"
          defaultValue={params.q || ""}
          placeholder="Search by name or email..."
          className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
        />
      </form>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="mb-4 h-12 w-12 opacity-40" />
          <p className="text-lg font-medium">No contacts found</p>
          <p className="text-sm">Add contacts manually or import a CSV file.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Link
                      href={`/admin/contacts/${contact.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{contact.email}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={SOURCE_VARIANTS[contact.source] || "outline"}>
                      {SOURCE_LABELS[contact.source] || contact.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contact.emailOptOut ? (
                      <Badge variant="destructive">Unsubscribed</Badge>
                    ) : contact.consentGiven ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Subscribed</Badge>
                    ) : (
                      <Badge variant="outline">No consent</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(contact.createdAt), "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
