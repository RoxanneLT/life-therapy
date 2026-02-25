"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Package, GraduationCap, FileDown, Plus } from "lucide-react";
import { format, addMonths, isAfter } from "date-fns";
import {
  grantCreditsAction,
  enrolInCourseAction,
  getAvailableCoursesAction,
} from "../actions";

interface OrderData {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  items: OrderItemData[];
}

interface OrderItemData {
  id: string;
  description: string;
  hybridPackageId: string | null;
  courseId: string | null;
  digitalProductId: string | null;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
}

interface EnrollmentData {
  id: string;
  courseId: string;
  progressPercent: number;
  enrolledAt: string;
  completedAt: string | null;
  course: { title: string; slug: string };
}

interface DigitalAccessData {
  id: string;
  grantedAt: string;
  digitalProduct: { title: string; slug: string };
}

interface CreditTxnData {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
}

interface PurchasesTabProps {
  client: Record<string, unknown>;
}

export function PurchasesTab({ client }: PurchasesTabProps) {
  const clientId = client.id as string;
  const orders = (client.orders as OrderData[]) || [];
  const enrollments = (client.enrollments as EnrollmentData[]) || [];
  const digitalAccess = (client.digitalProductAccess as DigitalAccessData[]) || [];
  const creditTxns = (client.creditTransactions as CreditTxnData[]) || [];

  // Build session packages from orders with hybridPackage items
  const packageItems = orders.flatMap((order) =>
    order.items
      .filter((item) => item.hybridPackageId)
      .map((item) => {
        const purchaseDate = new Date(order.paidAt || order.createdAt);
        const expiryDate = addMonths(purchaseDate, 6);
        // Calculate credits granted from this order's purchase transactions
        const purchaseTxn = creditTxns.find(
          (t) => t.type === "purchase" && new Date(t.createdAt).getTime() >= purchaseDate.getTime() - 60000 && new Date(t.createdAt).getTime() <= purchaseDate.getTime() + 60000,
        );
        const creditsGranted = purchaseTxn ? purchaseTxn.amount : item.quantity;
        return {
          key: item.id,
          description: item.description,
          purchaseDate,
          expiryDate,
          priceCents: item.totalCents,
          currency: order.currency,
          creditsGranted,
          expired: !isAfter(expiryDate, new Date()),
        };
      }),
  );

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-lg font-semibold">Purchases</h2>

      {/* Session Packages */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Session Packages
        </h3>
        {packageItems.length > 0 ? (
          packageItems.map((pkg) => (
            <Card key={pkg.key}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{pkg.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Purchased {format(pkg.purchaseDate, "d MMM yyyy")} ·{" "}
                      {formatCurrency(pkg.priceCents, pkg.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Credits granted: {pkg.creditsGranted} ·{" "}
                      {pkg.expired ? (
                        <span className="text-red-600">Expired</span>
                      ) : (
                        <>Expires: {format(pkg.expiryDate, "d MMM yyyy")}</>
                      )}
                    </p>
                  </div>
                  <Package className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No packages purchased.</p>
        )}
      </section>

      {/* Courses */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Courses
        </h3>
        {enrollments.length > 0 ? (
          enrollments.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{e.course.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Enrolled {format(new Date(e.enrolledAt), "d MMM yyyy")}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.round(e.progressPercent)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(e.progressPercent)}%
                      </span>
                      {e.completedAt && (
                        <Badge className="bg-green-100 text-green-700">
                          Completed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <GraduationCap className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No courses enrolled.</p>
        )}
      </section>

      {/* Digital Products */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Digital Products
        </h3>
        {digitalAccess.length > 0 ? (
          digitalAccess.map((d) => (
            <Card key={d.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.digitalProduct.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Granted {format(new Date(d.grantedAt), "d MMM yyyy")}
                    </p>
                  </div>
                  <FileDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No digital products.</p>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <GrantCreditsDialog clientId={clientId} />
        <EnrolCourseDialog clientId={clientId} />
      </div>
    </div>
  );
}

function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbols: Record<string, string> = {
    ZAR: "R",
    USD: "$",
    EUR: "\u20AC",
    GBP: "\u00A3",
  };
  const symbol = symbols[currency] || currency + " ";
  return `${symbol}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function GrantCreditsDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleGrant() {
    startTransition(async () => {
      await grantCreditsAction(clientId, amount, reason);
      setOpen(false);
      setAmount(1);
      setReason("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Grant Credits
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant Session Credits</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Credits to grant (1-20)</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Compensation for cancelled session"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleGrant}
            disabled={isPending || amount < 1 || amount > 20}
          >
            {isPending ? "Granting..." : `Grant ${amount} Credit${amount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnrolCourseDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getAvailableCoursesAction(clientId).then((c) => {
        setCourses(c);
        setSelectedCourseId(c[0]?.id || "");
        setLoading(false);
      });
    }
  }, [open, clientId]);

  function handleEnrol() {
    if (!selectedCourseId) return;
    startTransition(async () => {
      await enrolInCourseAction(clientId, selectedCourseId);
      setOpen(false);
      setSelectedCourseId("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <GraduationCap className="mr-2 h-4 w-4" />
          Enrol in Course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enrol in Course</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading courses...</p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No available courses (already enrolled in all published courses).
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Select course</Label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleEnrol}
            disabled={isPending || !selectedCourseId}
          >
            {isPending ? "Enrolling..." : "Enrol"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
