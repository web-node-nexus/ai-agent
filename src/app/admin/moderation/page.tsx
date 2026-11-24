import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/admin-format";

export default async function AdminModerationPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/app");

  const { service } = auth.ctx;
  const [{ data: reports }, { data: events }] = await Promise.all([
    service
      .from("reports")
      .select("id, user_id, message_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    service
      .from("moderation_events")
      .select("id, user_id, source, category, snippet, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          User reports and automated moderation events.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reports</h2>
        {(reports ?? []).map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{r.reason}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>
                User <span className="font-mono text-foreground/80">{r.user_id}</span>
              </p>
              {r.message_id && (
                <p>
                  Message{" "}
                  <span className="font-mono text-foreground/80">
                    {r.message_id}
                  </span>
                </p>
              )}
              <p>{formatDate(r.created_at)}</p>
            </CardContent>
          </Card>
        ))}
        {!reports?.length && (
          <p className="text-sm text-muted-foreground">No reports.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Moderation events</h2>
        {(events ?? []).map((e) => (
          <Card key={e.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{e.category}</CardTitle>
              <Badge variant="ai">{e.source}</Badge>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              {e.user_id && (
                <p>
                  User{" "}
                  <span className="font-mono text-foreground/80">{e.user_id}</span>
                </p>
              )}
              {e.snippet && (
                <p className="rounded-xl bg-black/20 p-2 text-foreground/80">
                  {e.snippet}
                </p>
              )}
              <p>{formatDate(e.created_at)}</p>
            </CardContent>
          </Card>
        ))}
        {!events?.length && (
          <p className="text-sm text-muted-foreground">No moderation events.</p>
        )}
      </section>
    </div>
  );
}
