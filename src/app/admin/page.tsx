"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPaise } from "@/lib/admin-format";

type Stats = {
  signups: number;
  trialStarted: number;
  activeSubs: number;
  revenuePaise: number;
  apiCostEstimatePaise: number;
};

const KPIS: { key: keyof Stats; label: string; format?: "money" }[] = [
  { key: "signups", label: "Signups" },
  { key: "trialStarted", label: "Trial started" },
  { key: "activeSubs", label: "Active subscriptions" },
  { key: "revenuePaise", label: "Revenue (paid)", format: "money" },
  { key: "apiCostEstimatePaise", label: "API cost estimate", format: "money" },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load stats");
        if (!cancelled) setStats(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live KPIs across signups, trials, subscriptions, and revenue.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPIS.map(({ key, label, format }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl tabular-nums">
                {stats == null
                  ? "…"
                  : format === "money"
                    ? formatPaise(stats[key])
                    : stats[key].toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Margin snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Revenue {formatPaise(stats.revenuePaise)} vs rough API cost{" "}
              {formatPaise(stats.apiCostEstimatePaise)} (placeholder ratio —
              replace with metered usage when available).
            </p>
            <p className="tabular-nums text-foreground">
              Est. gross after API:{" "}
              {formatPaise(stats.revenuePaise - stats.apiCostEstimatePaise)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
