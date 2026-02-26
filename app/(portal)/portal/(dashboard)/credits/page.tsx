export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, ArrowUpRight, ArrowDownRight, CalendarDays, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export default async function CreditsPage() {
  const { student } = await requirePasswordChanged();

  const [balance, transactions] = await Promise.all([
    prisma.sessionCreditBalance.findUnique({
      where: { studentId: student.id },
    }),
    prisma.sessionCreditTransaction.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const currentBalance = balance?.balance ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Session Credits</h1>

      {/* Balance card */}
      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
              <Coins className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-3xl font-bold">{currentBalance}</p>
            </div>
          </div>
          {currentBalance > 0 && (
            <Button asChild>
              <Link href="/portal/book">
                <CalendarDays className="mr-2 h-4 w-4" />
                Book a Session
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet. Purchase a credit pack to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isPositive = ["purchase", "admin_grant", "gift_received", "refund"].includes(
                  tx.type
                );
                const isForfeit = tx.description?.toLowerCase().includes("forfeit");
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {isPositive ? (
                        <ArrowDownRight className="h-4 w-4 text-green-500" />
                      ) : isForfeit ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.createdAt), "d MMM yyyy, HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          isPositive
                            ? "text-green-600"
                            : isForfeit
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {isPositive ? "+" : "-"}
                        {tx.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {tx.balanceAfter}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
