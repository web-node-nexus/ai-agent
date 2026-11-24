import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPaise } from "@/lib/admin-format";

function statusVariant(status: string) {
  if (status === "ready") return "success" as const;
  if (status === "blocked") return "ai" as const;
  if (status === "failed") return "muted" as const;
  return "default" as const;
}

export default async function AdminImagesPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/app");

  const { service } = auth.ctx;
  const { data: images } = await service
    .from("generated_images")
    .select(
      "id, user_id, character_id, prompt_brief, status, price_paise, was_free, storage_path, moderation_notes, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Images</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review generated image statuses (pending / ready / blocked / failed).
        </p>
      </div>

      <div className="space-y-3">
        {(images ?? []).map((img) => (
          <Card key={img.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="line-clamp-2 text-sm font-medium">
                {img.prompt_brief}
              </CardTitle>
              <Badge variant={statusVariant(img.status)}>{img.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>
                User <span className="font-mono text-foreground/80">{img.user_id}</span>
              </p>
              <p>
                {img.was_free ? "Free trial" : formatPaise(img.price_paise)} ·{" "}
                {formatDate(img.created_at)}
              </p>
              {img.storage_path && (
                <p className="font-mono truncate">{img.storage_path}</p>
              )}
              {img.moderation_notes && (
                <p className="text-amber-200/90">{img.moderation_notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {!images?.length && (
          <p className="text-sm text-muted-foreground">
            No generated images yet.
          </p>
        )}
      </div>
    </div>
  );
}
