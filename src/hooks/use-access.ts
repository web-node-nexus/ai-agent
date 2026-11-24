"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccessState } from "@/types/database";

export const ACCESS_QUERY_KEY = ["access"] as const;

async function fetchAccess(): Promise<AccessState> {
  const res = await fetch("/api/access", { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load access");
  }
  return res.json();
}

export function useAccess(options?: {
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ACCESS_QUERY_KEY,
    queryFn: fetchAccess,
    refetchInterval: options?.refetchInterval ?? 30_000,
    enabled: options?.enabled ?? true,
  });
}

export function useInvalidateAccess() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
}

export function useSetAccess() {
  const qc = useQueryClient();
  return (access: AccessState) => {
    qc.setQueryData(ACCESS_QUERY_KEY, access);
  };
}
