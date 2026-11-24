import type { AccessState } from "@/types/database";

/**
 * Temporary testing mode: calls + image generation are free.
 * - TESTING_FREE_MEDIA=true  → always free
 * - TESTING_FREE_MEDIA=false → real charges
 * - unset + development      → free (easier local testing)
 */
export function isTestingFreeMedia(): boolean {
  const v = process.env.TESTING_FREE_MEDIA?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return process.env.NODE_ENV === "development";
}

/** Soften access payload so UI + APIs allow call/image without wallet. */
export function applyFreeMediaAccess(access: AccessState): AccessState {
  if (!isTestingFreeMedia()) return access;
  return {
    ...access,
    can_call: !access.is_banned,
    can_generate_image: !access.is_banned,
    free_images_left: Math.max(access.free_images_left ?? 0, 999),
    image_price_paise: 0,
    video_paise_per_min: 0,
    video_min_balance_paise: 0,
  };
}
