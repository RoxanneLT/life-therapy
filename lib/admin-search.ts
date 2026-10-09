/**
 * The admin header's search: clients, bookings, invoices and orders in one query, grouped.
 *
 * Each group is gated by the roles of the page its results open, the same rule as the dashboard's
 * attention rows. Until 2026-10-09 the clients-only search admitted editor and refused marketing,
 * the exact inverse of /admin/clients/[id] — so an editor's every result bounced back to /admin and
 * marketing, who can open client records, could not search for one.
 *
 * Every word must match somewhere, so "jane smi" finds Jane Smith, which a single `contains` over
 * one column never did.
 */
import { prisma } from "@/lib/prisma";
import { saFormat } from "@/lib/dates";
import { formatPrice } from "@/lib/utils";
import type { AdminRole } from "@/lib/generated/prisma/client";

export interface SearchHit {
  id: string;
  label: string;
  detail?: string;
  href: string;
}

export interface SearchGroup {
  key: "clients" | "bookings" | "invoices" | "orders";
  label: string;
  hits: SearchHit[];
}

const PER_GROUP = 5;
const CLIENTS: AdminRole[] = ["super_admin", "marketing"];
const BOOKINGS: AdminRole[] = ["super_admin", "editor"];
const SUPER: AdminRole[] = ["super_admin"];

const words = (q: string) => q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
const ci = (value: string) => ({ contains: value, mode: "insensitive" as const });
/** Every word matches at least one of the fields. */
const allWords = <F extends string>(q: string, fields: F[]) => ({
  AND: words(q).map((w) => ({ OR: fields.map((f) => ({ [f]: ci(w) })) })),
});

export async function searchAdmin(q: string, role: AdminRole): Promise<SearchGroup[]> {
  if (q.trim().length < 2) return [];
  const can = (roles: AdminRole[]) => roles.includes(role);
  const none = Promise.resolve(null);

  const [clients, bookings, invoices, orders] = await Promise.all([
    can(CLIENTS)
      ? prisma.student.findMany({
          where: allWords(q, ["firstName", "lastName", "email"]),
          select: { id: true, firstName: true, lastName: true, email: true, clientStatus: true },
          orderBy: { lastName: "asc" },
          take: PER_GROUP,
        })
      : none,
    can(BOOKINGS)
      ? prisma.booking.findMany({
          where: allWords(q, ["clientName", "clientEmail", "couplesPartnerName"]),
          select: { id: true, clientName: true, sessionType: true, date: true, startTime: true, status: true },
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
          take: PER_GROUP,
        })
      : none,
    can(SUPER)
      ? prisma.invoice.findMany({
          where: allWords(q, ["invoiceNumber", "billingName", "billingEmail"]),
          select: { id: true, invoiceNumber: true, billingName: true, totalCents: true, currency: true, status: true },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP,
        })
      : none,
    can(SUPER)
      ? prisma.order.findMany({
          where: {
            OR: [
              { orderNumber: ci(q.trim()) },
              { student: allWords(q, ["firstName", "lastName", "email"]) },
            ],
          },
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            currency: true,
            status: true,
            student: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP,
        })
      : none,
  ]);

  const groups: SearchGroup[] = [
    {
      key: "clients",
      label: "Clients",
      hits: (clients ?? []).map((c) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName}`,
        detail: `${c.email} · ${c.clientStatus}`,
        href: `/admin/clients/${c.id}`,
      })),
    },
    {
      key: "bookings",
      label: "Bookings",
      hits: (bookings ?? []).map((b) => ({
        id: b.id,
        label: b.clientName,
        detail: `${b.sessionType.replaceAll("_", " ")} · ${saFormat(b.date, "d MMM yyyy")} ${b.startTime} · ${b.status.replaceAll("_", " ")}`,
        href: `/admin/bookings/${b.id}`,
      })),
    },
    {
      key: "invoices",
      label: "Invoices",
      // Billing has no per-invoice page; its list filters on `q`, so the invoice number lands on it.
      hits: (invoices ?? []).map((i) => ({
        id: i.id,
        label: i.invoiceNumber,
        detail: `${i.billingName} · ${formatPrice(i.totalCents, i.currency)} · ${i.status.replaceAll("_", " ")}`,
        href: `/admin/invoices?q=${encodeURIComponent(i.invoiceNumber)}`,
      })),
    },
    {
      key: "orders",
      label: "Orders",
      hits: (orders ?? []).map((o) => ({
        id: o.id,
        label: o.orderNumber,
        detail: `${o.student.firstName} ${o.student.lastName} · ${formatPrice(o.totalCents, o.currency)} · ${o.status}`,
        href: `/admin/orders/${o.id}`,
      })),
    },
  ];
  return groups.filter((g) => g.hits.length > 0);
}
