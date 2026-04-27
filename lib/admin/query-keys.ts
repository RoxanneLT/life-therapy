export const CLIENT_QUERY_KEYS = {
  bookings: (clientId: string) => ["client", clientId, "bookings"] as const,
  finances: (clientId: string) => ["client", clientId, "finances"] as const,
  personal: (clientId: string) => ["client", clientId, "personal"] as const,
  communications: (clientId: string) => ["client", clientId, "communications"] as const,
  insights: (clientId: string) => ["client", clientId, "insights"] as const,
  all: (clientId: string) => ["client", clientId] as const,
} as const;

export const STALE_TIMES = {
  bookings: 2 * 60 * 1000,
  finances: 3 * 60 * 1000,
  personal: 5 * 60 * 1000,
  communications: 2 * 60 * 1000,
  insights: 1 * 60 * 1000,
} as const;
