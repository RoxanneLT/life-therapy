export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import {
  createCreditPackAction,
  updateCreditPackAction,
  deleteCreditPackAction,
} from "./actions";

export default async function CreditsAdminPage() {
  await requireRole("super_admin");

  const packs = await prisma.sessionCreditPack.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const totalCreditsOutstanding = await prisma.sessionCreditBalance.aggregate({
    _sum: { balance: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Session Credit Packs
        </h1>
        <p className="text-sm text-muted-foreground">
          Total credits outstanding:{" "}
          {totalCreditsOutstanding._sum.balance || 0}
        </p>
      </div>

      {/* Existing packs */}
      {packs.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Credits</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-center">{p.credits}</TableCell>
                  <TableCell className="text-right">
                    {formatPrice(p.priceCents)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        p.isPublished
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {p.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <form action={updateCreditPackAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          type="hidden"
                          name="isPublished"
                          value={p.isPublished ? "false" : "true"}
                        />
                        <Button variant="ghost" size="sm" type="submit">
                          {p.isPublished ? "Unpublish" : "Publish"}
                        </Button>
                      </form>
                      <form action={deleteCreditPackAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <Button
                          variant="ghost"
                          size="sm"
                          type="submit"
                          className="text-destructive"
                        >
                          Delete
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {packs.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Coins className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No credit packs created yet.</p>
        </div>
      )}

      {/* Create new pack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Credit Pack</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={createCreditPackAction}
            className="grid gap-4 sm:grid-cols-4"
          >
            <div>
              <Label htmlFor="name" className="text-xs">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. 5 Session Pack"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="credits" className="text-xs">
                Credits
              </Label>
              <Input
                id="credits"
                name="credits"
                type="number"
                min="1"
                required
                placeholder="5"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="priceCents" className="text-xs">
                Price (cents)
              </Label>
              <Input
                id="priceCents"
                name="priceCents"
                type="number"
                min="0"
                required
                placeholder="400000"
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Create
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
