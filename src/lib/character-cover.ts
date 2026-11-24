/** Indian-only photoreal covers + matching multi-image galleries. */

/** Reserved for the 8 seeded companions. */
export const SEED_COVERS = {
  female: [
    "/characters/aanya/cover.jpg",
    "/characters/riya/cover.jpg",
    "/characters/naina/cover.jpg",
    "/characters/meher/cover.jpg",
  ],
  male: [
    "/characters/arjun/cover.jpg",
    "/characters/kabir/cover.jpg",
    "/characters/rohan/cover.jpg",
    "/characters/vihaan/cover.jpg",
  ],
} as const;

const SEED_SLUGS = new Set([
  "aanya",
  "riya",
  "naina",
  "meher",
  "arjun",
  "kabir",
  "rohan",
  "vihaan",
]);

/** Each row = same Indian person (cover + matching variants). */
export const INDIAN_GALLERIES = {
  female: [
    [
      "/characters/indian/f01.png",
      "/characters/indian/f01b.png",
      "/characters/indian/f01c.png",
    ],
    [
      "/characters/indian/f02.png",
      "/characters/indian/f02b.png",
      "/characters/indian/f02c.png",
    ],
    [
      "/characters/indian/f03.png",
      "/characters/indian/f03b.png",
      "/characters/indian/f03c.png",
    ],
    [
      "/characters/indian/f04.png",
      "/characters/indian/f04b.png",
      "/characters/indian/f04c.png",
    ],
    [
      "/characters/indian/f05.png",
      "/characters/indian/f05b.png",
      "/characters/indian/f05c.png",
    ],
    [
      "/characters/indian/f06.png",
      "/characters/indian/f06b.png",
      "/characters/indian/f06c.png",
    ],
    [
      "/characters/indian/f07.png",
      "/characters/indian/f07b.png",
      "/characters/indian/f07c.png",
    ],
    [
      "/characters/indian/f08.png",
      "/characters/indian/f08b.png",
      "/characters/indian/f08c.png",
    ],
  ],
  male: [
    [
      "/characters/indian/m01.png",
      "/characters/indian/m01b.png",
      "/characters/indian/m01c.png",
    ],
    [
      "/characters/indian/m02.png",
      "/characters/indian/m02b.png",
      "/characters/indian/m02c.png",
    ],
    [
      "/characters/indian/m03.png",
      "/characters/indian/m03b.png",
      "/characters/indian/m03c.png",
    ],
    [
      "/characters/indian/m04.png",
      "/characters/indian/m04b.png",
      "/characters/indian/m04c.png",
    ],
    [
      "/characters/indian/m05.png",
      "/characters/indian/m05b.png",
      "/characters/indian/m05c.png",
    ],
    [
      "/characters/indian/m06.png",
      "/characters/indian/m06b.png",
      "/characters/indian/m06c.png",
    ],
    [
      "/characters/indian/m07.png",
      "/characters/indian/m07b.png",
      "/characters/indian/m07c.png",
    ],
    [
      "/characters/indian/m08.png",
      "/characters/indian/m08b.png",
      "/characters/indian/m08c.png",
    ],
  ],
} as const;

export const INDIAN_STOCK = {
  female: INDIAN_GALLERIES.female.map((g) => g[0]!),
  male: INDIAN_GALLERIES.male.map((g) => g[0]!),
};

/** @deprecated */
export const STOCK_COVERS = SEED_COVERS;

const SEED_COVER_SET = new Set<string>([
  ...SEED_COVERS.female,
  ...SEED_COVERS.male,
]);

export function isSeedCover(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url;
    return (
      SEED_COVER_SET.has(path) ||
      [...SEED_COVER_SET].some((p) => path.endsWith(p))
    );
  } catch {
    return SEED_COVER_SET.has(url);
  }
}

export function isNonIndianOrBadCover(url: string | null | undefined): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  return (
    u.includes("randomuser.me") ||
    u.includes("dicebear.com") ||
    u.includes("avatars.dicebear") ||
    u.includes("ui-avatars.com") ||
    u.includes("robohash.org") ||
    u.includes("pravatar.cc") ||
    u.includes("thispersondoesnotexist") ||
    u.includes("placeholder") ||
    u.includes("/svg") ||
    u.endsWith(".svg") ||
    u.includes("cover.svg") ||
    u.includes("ref1.svg")
  );
}

export function isCartoonOrPlaceholderCover(
  url: string | null | undefined
): boolean {
  return isNonIndianOrBadCover(url);
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function existingOnly(urls: string[]): string[] {
  // Client/server both can use paths; missing variants fall back to first
  const uniq = [...new Set(urls.filter(Boolean))];
  return uniq.length ? uniq : [];
}

export function uniqueCoverFor(
  gender: "male" | "female" | string | null | undefined,
  seed = "default"
): string {
  const g = gender === "male" ? "male" : "female";
  const pool = INDIAN_STOCK[g];
  return pool[hashSeed(seed) % pool.length]!;
}

export function stockCoverFor(
  gender: "male" | "female" | string | null | undefined,
  seed = "default"
): string {
  return uniqueCoverFor(gender, seed);
}

/** Full matching gallery for a generated persona index. */
export function indianGalleryFor(
  gender: "male" | "female" | string | null | undefined,
  seed = "default"
): string[] {
  const g = gender === "male" ? "male" : "female";
  const galleries = INDIAN_GALLERIES[g];
  const gallery = galleries[hashSeed(seed) % galleries.length]!;
  const cover = gallery[0]!;
  // Until variants exist on disk, still return cover multiple times filtered unique
  return existingOnly([...gallery]);
}

export function pickUnusedIndianCover(
  gender: "male" | "female" | string | null | undefined,
  seed: string,
  taken: Set<string>
): string {
  const g = gender === "male" ? "male" : "female";
  const galleries = INDIAN_GALLERIES[g];
  for (let i = 0; i < galleries.length; i++) {
    const gallery = galleries[(hashSeed(seed) + i) % galleries.length]!;
    const cover = gallery[0]!;
    if (!taken.has(cover)) return cover;
  }
  return uniqueCoverFor(gender, seed);
}

export function pickUnusedIndianGallery(
  gender: "male" | "female" | string | null | undefined,
  seed: string,
  taken: Set<string>
): string[] {
  const g = gender === "male" ? "male" : "female";
  const galleries = INDIAN_GALLERIES[g];
  for (let i = 0; i < galleries.length; i++) {
    const gallery = galleries[(hashSeed(seed) + i) % galleries.length]!;
    const cover = gallery[0]!;
    if (!taken.has(cover)) return existingOnly([...gallery]);
  }
  return indianGalleryFor(gender, seed);
}

export function seedGalleryFor(slug: string): string[] {
  // Variants may be .jpg or .png depending on image model output
  return existingOnly([
    `/characters/${slug}/cover.jpg`,
    `/characters/${slug}/ref1.png`,
    `/characters/${slug}/ref1.jpg`,
    `/characters/${slug}/ref2.png`,
    `/characters/${slug}/ref2.jpg`,
    `/characters/${slug}/ref3.png`,
    `/characters/${slug}/ref3.jpg`,
  ]);
}

/** Cover + matching photos for feed / chat. */
export function resolveCharacterGallery(params: {
  coverUrl?: string | null;
  referenceUrls?: string[] | null;
  gender?: string | null;
  slug?: string | null;
  id?: string | null;
}): string[] {
  const { coverUrl, referenceUrls, gender, slug, id } = params;
  const seed = slug || id || "companion";
  const isSeedChar = slug ? SEED_SLUGS.has(slug) : false;

  if (isSeedChar && slug) {
    return seedGalleryFor(slug);
  }

  const refs = (referenceUrls || []).filter(
    (u) => u && !isNonIndianOrBadCover(u)
  );
  if (refs.length >= 2) {
    const cover =
      coverUrl && !isNonIndianOrBadCover(coverUrl) && !isSeedCover(coverUrl)
        ? coverUrl
        : refs[0]!;
    return existingOnly([cover, ...refs]);
  }

  if (coverUrl && coverUrl.includes("/characters/indian/")) {
    const base = coverUrl.replace(/\.(png|jpg|jpeg)$/i, "");
    const match = /\/(f|m)(\d{2})(?:[bc])?$/i.exec(base);
    if (match) {
      const id = `${match[1]!.toLowerCase()}${match[2]}`;
      return existingOnly([
        `/characters/indian/${id}.png`,
        `/characters/indian/${id}b.png`,
        `/characters/indian/${id}b.jpg`,
        `/characters/indian/${id}c.png`,
        `/characters/indian/${id}c.jpg`,
      ]);
    }
  }

  if (
    coverUrl &&
    !isNonIndianOrBadCover(coverUrl) &&
    !isSeedCover(coverUrl)
  ) {
    return existingOnly([coverUrl, ...(referenceUrls || [])]);
  }

  return indianGalleryFor(gender, seed);
}

export function resolveCharacterCover(params: {
  coverUrl?: string | null;
  gender?: string | null;
  slug?: string | null;
  id?: string | null;
}): string {
  const gallery = resolveCharacterGallery(params);
  return gallery[0] || uniqueCoverFor(params.gender, params.slug || params.id || "companion");
}
