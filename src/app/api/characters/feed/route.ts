import { NextResponse } from "next/server";
import { requireUser, getProfile } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAiCharacter } from "@/lib/ai/generate-character";
import {
  isNonIndianOrBadCover,
  isSeedCover,
  resolveCharacterGallery,
  uniqueCoverFor,
} from "@/lib/character-cover";
import { createServiceClient } from "@/lib/supabase/server";
import type { Character, Gender } from "@/types/database";

const MAX_ACTIVE_GEN = 20;

function withRealCover(c: Character): Character {
  const gallery = resolveCharacterGallery({
    coverUrl: c.cover_url,
    referenceUrls: c.reference_image_urls,
    gender: c.gender,
    slug: c.slug,
    id: c.id,
  });
  const cover = gallery[0] || c.cover_url;
  return {
    ...c,
    cover_url: cover,
    reference_image_urls: gallery.length ? gallery : [cover],
  };
}

function targetGenders(userGender: Gender | null): Array<"male" | "female"> {
  if (userGender === "female") return ["male"];
  if (userGender === "male") return ["female"];
  return ["female", "male"];
}

/** Keep first of each display name (case-insensitive). */
function dedupeByName(list: Character[]): Character[] {
  const seen = new Set<string>();
  const out: Character[] = [];
  for (const c of list) {
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Fisher–Yates — new order every refresh. */
function shuffle<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export async function GET(request: Request) {
  const { user, error: authError } = await requireUser();
  if (authError || !user) return authError!;

  const limited = await rateLimit("chat", `feed:${user.id}`);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Slow down — scroll and try again." },
      { status: 429 }
    );
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.is_banned) {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset") || 0));
  const limit = Math.min(
    12,
    Math.max(1, Number(searchParams.get("limit") || 6))
  );
  const generate = searchParams.get("generate") !== "0";
  const exclude = new Set(
    (searchParams.get("exclude") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const genders = targetGenders(profile.gender);
  const service = createServiceClient();

  // Soft-deactivate duplicate gen names (keep earliest sort_order)
  if (offset === 0 && exclude.size === 0) {
    const { data: allActive } = await service
      .from("characters")
      .select("id, name, slug, sort_order")
      .eq("is_active", true)
      .in("gender", genders)
      .order("sort_order", { ascending: true });

    const nameFirst = new Map<string, string>();
    const dupIds: string[] = [];
    for (const row of allActive ?? []) {
      const key = String(row.name).trim().toLowerCase();
      if (!nameFirst.has(key)) {
        nameFirst.set(key, row.id);
        continue;
      }
      if (String(row.slug).startsWith("gen-")) dupIds.push(row.id);
    }
    if (dupIds.length) {
      await service
        .from("characters")
        .update({ is_active: false })
        .in("id", dupIds);
    }
  }

  // Pull a wide pool, shuffle, then page — so refresh doesn't always show same top profile
  const poolCap = Math.min(120, Math.max(48, limit * 20));
  const { data: rows, error } = await service
    .from("characters")
    .select("*")
    .eq("is_active", true)
    .in("gender", genders)
    .order("sort_order", { ascending: true })
    .limit(poolCap);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawRows = (rows ?? []) as Character[];
  let pool = dedupeByName(rawRows.map(withRealCover)).filter(
    (c) => !exclude.has(c.id)
  );
  pool = shuffle(pool);
  let characters = pool.slice(0, limit);
  let createdCount = 0;

  // Heal foreign / cartoon / stolen-seed faces → Indian stock only
  for (let i = 0; i < characters.length; i++) {
    const raw = characters[i]!;
    const needsHeal =
      isNonIndianOrBadCover(raw.cover_url) ||
      (String(raw.slug).startsWith("gen-") && isSeedCover(raw.cover_url));
    if (!needsHeal) continue;
    const fixed = withRealCover({
      ...raw,
      cover_url: uniqueCoverFor(raw.gender, raw.slug || raw.id),
    });
    void service
      .from("characters")
      .update({
        cover_url: fixed.cover_url,
        reference_image_urls: fixed.reference_image_urls,
      })
      .eq("id", raw.id);
    characters[i] = fixed;
  }

  const { count: genCount } = await service
    .from("characters")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("gender", genders)
    .like("slug", "gen-%");

  const canMint =
    generate &&
    characters.length < limit &&
    (genCount ?? 0) < MAX_ACTIVE_GEN;

  if (canMint) {
    const need = limit - characters.length;
    const created: Character[] = [];
    for (let i = 0; i < need; i++) {
      if ((genCount ?? 0) + created.length >= MAX_ACTIVE_GEN) break;
      const genLimit = await rateLimit("image", `chargen:${user.id}`);
      if (!genLimit.success) break;
      const g =
        genders.length === 1
          ? genders[0]!
          : Math.random() > 0.5
            ? "female"
            : "male";
      try {
        const c = withRealCover(await createAiCharacter(g, { fast: true }));
        if (
          characters.some(
            (x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase()
          ) ||
          pool.some(
            (x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase()
          )
        ) {
          await service
            .from("characters")
            .update({ is_active: false })
            .eq("id", c.id);
          continue;
        }
        created.push(c);
      } catch (e) {
        console.error("[characters/feed] generate", e);
        break;
      }
    }
    createdCount = created.length;
    characters = shuffle(dedupeByName([...characters, ...created]));
  }

  const remainingInPool = Math.max(0, pool.length - characters.length);
  const hasMore =
    remainingInPool > 0 ||
    (generate && (genCount ?? 0) + createdCount < MAX_ACTIVE_GEN);

  return NextResponse.json({
    characters,
    offset,
    nextOffset: offset + characters.length,
    hasMore,
    shuffled: true,
    trial_note:
      "3 minutes free on your first chat (account-wide). After that, subscribe or use wallet for video calls.",
  });
}
