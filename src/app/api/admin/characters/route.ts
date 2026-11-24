import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, writeAdminAudit } from "@/lib/admin";

const PatchSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  bio: z.string().max(2000).optional(),
  name: z.string().min(1).max(80).optional(),
  city: z.string().max(80).optional(),
  speaking_style: z.string().max(500).optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { service } = auth.ctx;
  const { data, error } = await service
    .from("characters")
    .select(
      "id, slug, name, gender, age, city, bio, tags, speaking_style, voice_name, cover_url, is_active, sort_order"
    )
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ characters: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { service, user: admin } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id, ...rest } = parsed.data;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) patch[k] = v;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  const { data, error } = await service
    .from("characters")
    .update(patch)
    .eq("id", id)
    .select(
      "id, slug, name, gender, age, city, bio, tags, speaking_style, voice_name, cover_url, is_active, sort_order"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAdminAudit(service, admin.id, "character_patch", {
    character_id: id,
    patch,
  });

  return NextResponse.json({ character: data });
}
