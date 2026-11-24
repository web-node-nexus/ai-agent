import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, writeAdminAudit } from "@/lib/admin";
import { getAppSettings } from "@/lib/settings";

const PutSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { service } = auth.ctx;
  const { data, error } = await service
    .from("app_settings")
    .select("key, value, updated_at, updated_by")
    .order("key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const merged = await getAppSettings();
  return NextResponse.json({ rows: data ?? [], merged });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { service, user: admin } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { key, value } = parsed.data;

  const { data, error } = await service
    .from("app_settings")
    .upsert(
      {
        key,
        value,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("key, value, updated_at, updated_by")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAdminAudit(service, admin.id, "settings_update", { key, value });

  return NextResponse.json({ row: data });
}
