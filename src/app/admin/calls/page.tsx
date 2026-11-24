import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPaise } from "@/lib/admin-format";

export default async function AdminCallsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/app");

  const { service } = auth.ctx;
  const { data: calls } = await service
    .from("call_sessions")
    .select(
      "id, user_id, character_id, started_at, ended_at, seconds_billed, paise_charged, end_reason, last_heartbeat_at"
    )
    .order("started_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent video/voice call sessions and billing.
        </p>
      </div>

      <div className="space-y-3">
        {(calls ?? []).map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium tabular-nums">
                {c.seconds_billed}s · {formatPaise(c.paise_charged)}
              </CardTitle>
              {c.ended_at ? (
                <Badge variant="muted">{c.end_reason ?? "ended"}</Badge>
              ) : (
                <Badge variant="success">live</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>
                User <span className="font-mono text-foreground/80">{c.user_id}</span>
              </p>
              <p>
                Character{" "}
                <span className="font-mono text-foreground/80">
                  {c.character_id}
                </span>
              </p>
              <p>
                Started {formatDate(c.started_at)}
                {c.ended_at ? ` · ended ${formatDate(c.ended_at)}` : ""}
              </p>
              <p>Last heartbeat {formatDate(c.last_heartbeat_at)}</p>
            </CardContent>
          </Card>
        ))}
        {!calls?.length && (
          <p className="text-sm text-muted-foreground">No call sessions yet.</p>
        )}
      </div>
    </div>
  );
}
