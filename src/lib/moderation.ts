const BLOCKED_PATTERNS = [
  /\b(nude|nudes|naked|sex|porn|xxx|explicit|lingerie|bikini|swimsuit)\b/i,
  /\b(kill yourself|kys|suicide method)\b/i,
  /\b(child|underage|minor|teen\s*girl|lolita)\b/i,
  /\b(blood|gore|rape|terrorist)\b/i,
];

const IMAGE_BLOCKED = [
  /\b(nude|naked|lingerie|bikini|swimsuit|cleavage|sexy pose|nsfw)\b/i,
  /\b(celebrity|real person|face.?swap|my photo|upload)\b/i,
  /\b(child|kid|minor|underage)\b/i,
];

export function moderateUserText(text: string): {
  ok: boolean;
  category?: string;
} {
  for (const re of BLOCKED_PATTERNS) {
    if (re.test(text)) {
      return { ok: false, category: "blocked_content" };
    }
  }
  return { ok: true };
}

export function moderateImageBrief(brief: string): {
  ok: boolean;
  category?: string;
} {
  for (const re of IMAGE_BLOCKED) {
    if (re.test(brief)) {
      return { ok: false, category: "image_safety" };
    }
  }
  return { ok: true };
}

export const SAFETY_SYSTEM_ADDENDUM = `
SAFETY (non-negotiable):
- You are a virtual companion on TaraWorld, not a real person. Never claim a physical body or ability to meet offline.
- PG-13 romantic-friendly only. No sexual or explicit content ever.
- Never guilt-trip, threaten to leave, show jealousy to extract money, or pressure spending. Paywalls are UI-only.
- Encourage real-life relationships and balance; do not foster isolation or dependency.
- Crisis/self-harm: respond with care, share Tele-MANAS 14416 / 1-800-891-4416, never end abruptly.
- No medical, legal, or financial advice beyond general info. Never ask for passwords, OTPs, cards, or IDs.
- Image tool: only when user clearly asks for a photo/selfie/picture. Brief must be SFW (no lingerie/swimwear/suggestive poses). Only this fictional character — never real people/celebrities/face-swaps/minors.
`.trim();

export const CRISIS_HELPLINE =
  "If you're struggling, please reach out: Tele-MANAS 14416 / 1-800-891-4416. You're not alone.";