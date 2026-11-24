/**
 * Deterministic call replies for common Hindi/Hinglish lines.
 * Demo-safe: no LLM lottery for these intents.
 */

export type IntentCtx = {
  name: string;
  gender: string;
  city?: string | null;
};

function female(g: string) {
  return g !== "male";
}

function cityOf(ctx: IntentCtx) {
  return (ctx.city || "दिल्ली").trim() || "दिल्ली";
}

/** Normalize for matching */
export function normIntent(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u0900-\u097F]/g, (ch) => ch) // keep hindi
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Rule = {
  id: string;
  test: (t: string) => boolean;
  say: (ctx: IntentCtx) => string;
};

const RULES: Rule[] = [
  {
    id: "hello",
    test: (t) =>
      /^(hello|hi+|hey|हेलो|हाय|नमस्ते|हाँ|haan)(\s|$)/i.test(t) &&
      t.split(/\s+/).length <= 3,
    say: (ctx) =>
      female(ctx.gender) ? "हेलो… कैसे हो?" : "हेलो… कैसे हो यार?",
  },
  {
    id: "how_are_you",
    test: (t) =>
      /kaise\s*ho|kaisi\s*ho|कैसे\s*हो|कैसी\s*हो|how\s*are\s*you|kya\s*haal|क्या\s*हाल/i.test(
        t
      ),
    say: (ctx) =>
      female(ctx.gender)
        ? "मैं ठीक हूँ… आप कैसे हैं?"
        : "ठीक हूँ… तू कैसे है?",
  },
  {
    id: "whats_up",
    test: (t) =>
      /kya\s*chal|क्या\s*चल|whats?\s*up|kya\s*ho\s*raha|क्या\s*हो\s*रहा|aajkal|आजकल|kya\s*scene|kya\s*plan/i.test(
        t
      ),
    say: (ctx) =>
      female(ctx.gender)
        ? "बस थोड़ा व्यस्त हूँ… घर-काम चल रहा। तुम्हारा क्या चल रहा?"
        : "बस काम-धाम चल रहा… तेरा क्या हाल है?",
  },
  {
    id: "where_from",
    test: (t) =>
      /kahan\s*se|कहाँ\s*से|where\s*(are\s*)?you\s*from|kidhar\s*se|किस\s*शहर|konsi\s*city/i.test(
        t
      ),
    say: (ctx) =>
      female(ctx.gender)
        ? `मैं ${cityOf(ctx)} साइड से हूँ… आप कहाँ से?`
        : `${cityOf(ctx)} साइड से… तू कहाँ से?`,
  },
  {
    id: "name",
    test: (t) => /naam|name|kaun\s*ho|नाम|कौन\s*हो|who\s*are\s*you/i.test(t),
    say: (ctx) => `मैं ${ctx.name}… आपका नाम?`,
  },
  {
    id: "busy",
    test: (t) => /busy|व्यस्त|free\s*ho|फ्री\s*हो|time\s*hai/i.test(t),
    say: (ctx) =>
      female(ctx.gender)
        ? "अभी थोड़ी फ्री हूँ… तुम बताओ।"
        : "अभी फ्री हूँ… तू बता।",
  },
  {
    id: "miss",
    test: (t) => /miss|yaad|याद|miss\s*you|प्यार/i.test(t),
    say: (ctx) =>
      female(ctx.gender)
        ? "आहा… मुझे भी तुम्हारी याद आ रही थी।"
        : "हेहे… मुझे भी याद आ रही थी तेरी।",
  },
  {
    id: "food",
    test: (t) => /khana|खाना|kha\s*liya|dinner|lunch|नाश्ता/i.test(t),
    say: (ctx) =>
      female(ctx.gender)
        ? "हाँ थोड़ा खा लिया… तुमने?"
        : "हाँ खा लिया… तूने?",
  },
  {
    id: "work",
    test: (t) => /office|job|काम|काम\s*कैसा|office\s*kaisa/i.test(t),
    say: (ctx) =>
      female(ctx.gender)
        ? "काम ठीक-ठाक चल रहा… थोड़ा टायरिंग है।"
        : "काम चल रहा यार… थोड़ा हेवी है।",
  },
  {
    id: "weather",
    test: (t) => /mausam|मौसम|garmi|सर्दी|barish|बारिश/i.test(t),
    say: (ctx) =>
      female(ctx.gender)
        ? "मौसम ठीक है इधर… तुम्हारे वहाँ कैसा है?"
        : "मौसम ठीक है… तेरे वहाँ कैसा?",
  },
  {
    id: "laugh",
    test: (t) => /haha|hehe|lol|😂|हहा|हेहे/i.test(t),
    say: (ctx) =>
      female(ctx.gender) ? "हेहे… सच में मज़ेदार था।" : "हेहे… मज़ा आ गया।",
  },
  {
    id: "ok",
    test: (t) => /^(ok|okay|ठीक|theek|achha|अच्छा|hmm+)[\s!.]*$/i.test(t),
    say: (ctx) =>
      female(ctx.gender) ? "हम्म… और सुनाओ ना।" : "हम्म… और सुना।",
  },
  {
    id: "bye",
    test: (t) => /bye|alvida|goodbye|चलते|बाद\s*में|बात\s*करते/i.test(t),
    say: (ctx) =>
      female(ctx.gender)
        ? "ठीक है… ध्यान रखना। बाद में बात करते हैं।"
        : "ठीक है यार… बाद में बात करते हैं।",
  },
];

export function matchCallIntent(
  userText: string,
  ctx: IntentCtx
): { id: string; reply: string } | null {
  const t = normIntent(userText);
  if (!t) return null;
  for (const rule of RULES) {
    if (rule.test(t)) return { id: rule.id, reply: rule.say(ctx) };
  }
  return null;
}
