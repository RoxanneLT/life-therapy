"use client";

import { useQuery } from "@tanstack/react-query";
import { CLIENT_QUERY_KEYS, STALE_TIMES } from "@/lib/admin/query-keys";
import {
  fetchClientBookings,
  fetchClientFinances,
  fetchClientRelationships,
  fetchClientCommunications,
  fetchClientInsights,
} from "./queries";

export function useClientBookings(clientId: string) {
  return useQuery({
    queryKey: CLIENT_QUERY_KEYS.bookings(clientId),
    queryFn: () => fetchClientBookings(clientId),
    staleTime: STALE_TIMES.bookings,
  });
}

export function useClientFinances(clientId: string) {
  return useQuery({
    queryKey: CLIENT_QUERY_KEYS.finances(clientId),
    queryFn: () => fetchClientFinances(clientId),
    staleTime: STALE_TIMES.finances,
  });
}

export function useClientRelationships(clientId: string) {
  return useQuery({
    queryKey: CLIENT_QUERY_KEYS.personal(clientId),
    queryFn: () => fetchClientRelationships(clientId),
    staleTime: STALE_TIMES.personal,
  });
}

export function useClientCommunications(clientId: string) {
  return useQuery({
    queryKey: CLIENT_QUERY_KEYS.communications(clientId),
    queryFn: () => fetchClientCommunications(clientId),
    staleTime: STALE_TIMES.communications,
  });
}

export function useClientInsights(clientId: string) {
  return useQuery({
    queryKey: CLIENT_QUERY_KEYS.insights(clientId),
    queryFn: () => fetchClientInsights(clientId),
    staleTime: STALE_TIMES.insights,
  });
}
