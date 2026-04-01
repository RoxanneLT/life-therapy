// ─── Booking ──────────────────────────────────────────────────────────────────

export const BOOKING_STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-gray-100 text-gray-800",
};

/** Solid dot colour for calendar/week views */
export const BOOKING_STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-green-400",
  completed: "bg-blue-400",
  cancelled: "bg-red-400",
  no_show: "bg-gray-400",
};

// ─── Order ────────────────────────────────────────────────────────────────────

export const ORDER_STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
  partially_refunded: "bg-orange-100 text-orange-800",
};

// ─── Invoice ──────────────────────────────────────────────────────────────────

export const INVOICE_STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  payment_requested: "bg-yellow-100 text-yellow-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  credited: "bg-blue-100 text-blue-700",
  void: "bg-red-100 text-red-700",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  payment_requested: "Requested",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  credited: "Credited",
  void: "Void",
};

// ─── Payment Request ──────────────────────────────────────────────────────────

export const PR_STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
};

export const PR_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Voided",
};

// ─── Gift ─────────────────────────────────────────────────────────────────────

export const GIFT_STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  delivered: "bg-blue-100 text-blue-800",
  redeemed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

// ─── Client ───────────────────────────────────────────────────────────────────

export const CLIENT_STATUS_BADGE: Record<string, string> = {
  potential: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  archived: "bg-red-100 text-red-700",
};

// ─── Campaign ─────────────────────────────────────────────────────────────────

export const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  active: "bg-green-100 text-green-800 hover:bg-green-100",
  completed: "bg-teal-100 text-teal-800 hover:bg-teal-100",
  paused: "bg-amber-100 text-amber-800 hover:bg-amber-100",
};
