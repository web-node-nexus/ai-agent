import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/admin-format";

export default async function AdminAuditPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/app");

  const { service } = auth.ctx;
  const { data: logs } = await service
    .from("admin_audit_log")
    .select("id, admin_id, action, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin actions (wallet adjusts, bans, settings, character edits).
        </p>
      </div>

      <div className="space-y-3">
        {(logs ?? []).map((log) => (
          <Card key={log.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{log.action}</CardTitle>
              <Badge variant="muted">{formatDate(log.created_at)}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                Admin{" "}
                <span className="font-mono text-foreground/80">{log.admin_id}</span>
              </p>
              <pre className="overflow-x-auto rounded-xl bg-black/25 p-3 font-mono text-[11px] text-foreground/80">
                {JSON.stringify(log.meta ?? {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ))}
        {!logs?.length && (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        )}
      </div>
    </div>
  );
}
