/**
 * DEPRECATED — do not use for live call replies.
 * Kept only so old imports don't break builds. Call brain is LLM-only in human-reply.ts.
 */

export type IntentCtx = {
  name: string;
  gender: string;
  city?: string | null;
};

export function normIntent(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Always null — scripted intents removed. */
export function matchCallIntent(
  _userText: string,
  _ctx: IntentCtx
): { id: string; reply: string } | null {
  return null;
}
