import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPaise } from "@/lib/admin-format";

export default async function AdminPaymentsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/app");

  const { service } = auth.ctx;
  const { data: payments } = await service
    .from("payments")
    .select(
      "id, user_id, kind, status, amount_paise, gst_paise, pack_key, razorpay_payment_id, razorpay_order_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest 100 wallet and subscription payments.
        </p>
      </div>

      <div className="space-y-3">
        {(payments ?? []).map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {formatPaise(p.amount_paise)}{" "}
                <span className="text-muted-foreground">· {p.kind}</span>
              </CardTitle>
              <Badge
                variant={p.status === "paid" ? "success" : "muted"}
                className={
                  p.status === "failed"
                    ? "bg-red-500/20 text-red-200"
                    : undefined
                }
              >
                {p.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>
                User <span className="font-mono text-foreground/80">{p.user_id}</span>
              </p>
              <p>
                Pack {p.pack_key ?? "—"} · GST {formatPaise(p.gst_paise)} ·{" "}
                {formatDate(p.created_at)}
              </p>
              <p className="font-mono truncate">
                {p.razorpay_payment_id ?? p.razorpay_order_id ?? "no rzp id"}
              </p>
            </CardContent>
          </Card>
        ))}
        {!payments?.length && (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        )}
      </div>
    </div>
  );
}
