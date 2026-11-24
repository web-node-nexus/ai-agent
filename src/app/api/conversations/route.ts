import { getProfile, requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { matchCharacterGender } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z
  .object({
    character_id: z.string().uuid().optional(),
    slug: z.string().min(1).optional(),
    characterSlug: z.string().min(1).optional(),
  })
  .transform((d) => ({
    character_id: d.character_id,
    slug: d.slug || d.characterSlug,
  }))
  .refine((d) => d.character_id || d.slug, {
    message: "character_id or slug required",
  });

export async function GET() {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  const service = createServiceClient();
  const { data, error: qError } = await service
    .from("conversations")
    .select(
      "id, user_id, character_id, created_at, last_message_at, character:characters(*)"
    )
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error!;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.is_banned) {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  const service = createServiceClient();
  let characterQuery = service
    .from("characters")
    .select("*")
    .eq("is_active", true);

  if (parsed.data.character_id) {
    characterQuery = characterQuery.eq("id", parsed.data.character_id);
  } else {
    characterQuery = characterQuery.eq("slug", parsed.data.slug!);
  }

  const { data: character, error: charError } = await characterQuery.maybeSingle();
  if (charError) {
    return NextResponse.json({ error: charError.message }, { status: 500 });
  }
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  if (
    !matchCharacterGender(
      profile.gender,
      character.gender as "male" | "female"
    )
  ) {
    return NextResponse.json(
      { error: "Character not available for your profile" },
      { status: 403 }
    );
  }

  const { data: existing } = await service
    .from("conversations")
    .select("*, character:characters(*)")
    .eq("user_id", user.id)
    .eq("character_id", character.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ conversation: existing, created: false });
  }

  const { data: created, error: createError } = await service
    .from("conversations")
    .insert({
      user_id: user.id,
      character_id: character.id,
    })
    .select("*, character:characters(*)")
    .single();

  if (createError) {
    // Race: unique (user_id, character_id)
    if (createError.code === "23505") {
      const { data: again } = await service
        .from("conversations")
        .select("*, character:characters(*)")
        .eq("user_id", user.id)
        .eq("character_id", character.id)
        .maybeSingle();
      if (again) {
        return NextResponse.json({ conversation: again, created: false });
      }
    }
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: created, created: true }, { status: 201 });
}
