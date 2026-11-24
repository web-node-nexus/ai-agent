/**
 * Call reply brain — LLM ONLY.
 * Reply must follow what the user just said. No intent / script bank.
 */

import Anthropic from "@anthropic-ai/sdk";
import { isGenericCallReply } from "@/lib/call/natural-reply";
import { stripForSpeech } from "@/lib/call/conversation-memory";

export type CallReplyParams = {
  name: string;
  gender: string;
  city: string | null;
  persona: string;
  style: string | null;
  bio: string | null;
  history: string;
  chatContext?: string;
  userText: string;
  recentAssistant: string[];
  turnIndex: number;
};

export type CallReplyResult = {
  text: string;
  provider: "claude" | "gemini" | "soft";
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(t);
        console.warn("[call-reply] provider error", err);
        resolve(null);
      });
  });
}

export function looksLikeBadHear(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return true;
  if (/^[a-z]{1,2}$/i.test(t)) return true;
  if (/^(um+|uh+|aa+|ee+|hmm+|अ+|उ+)$/i.test(t)) return true;
  return false;
}

function normWords(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEchoReply(userText: string, reply: string): boolean {
  const u = normWords(userText);
  const r = normWords(reply);
  if (!u || !r) return false;
  if (r.includes(u) && u.length >= 8) return true;
  const uCore = u
    .replace(/^(hmm+|haan|acha|accha|are|arre|yaar)\s+/g, "")
    .trim();
  const rCore = r
    .replace(/^(hmm+|haan|acha|accha|are|arre|yaar|oh)\s+/g, "")
    .replace(/^aur\s+/g, "")
    .trim();
  if (uCore.length >= 6 && (rCore.includes(uCore) || uCore.includes(rCore))) {
    return true;
  }
  if (
    /aur\s+kya\s+chal|और\s+क्या\s+चल/i.test(reply) &&
    /chal|क्या\s*चल|aajkal/i.test(userText)
  ) {
    return true;
  }
  return false;
}

function looksLikeJunkModelOutput(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return true;
  if (/^(options?|option\s*\d|here(?:'s| is)|as an ai)/i.test(t)) return true;
  if (/thought|reasoning|step\s*\d/i.test(t) && t.length < 40) return true;
  if (/^[\{\[]/.test(t)) return true;
  return false;
}

function buildHumanPrompt(p: CallReplyParams) {
  const recentBan =
    p.recentAssistant.length > 0
      ? `Don't repeat these recent lines:\n- ${p.recentAssistant.slice(-3).join("\n- ")}`
      : "";
  const personaShort = (p.persona || "").slice(0, 240);
  const bioShort = (p.bio || "").slice(0, 100);
  const cityBit = p.city || "India";
  const female = p.gender !== "male";
  const chatBlock = p.chatContext?.trim()
    ? `Earlier text chat (continue a topic only if they refer to it):\n${p.chatContext.slice(0, 600)}`
    : "No prior chat.";

  return `You are ${p.name} from ${cityBit}, on a live phone call with a friend in India.
You are a real soft-spoken ${female ? "girl" : "guy"} — NOT a bot, NOT a script, NOT customer care.

Who you are (don't recite):
${personaShort}
${bioShort ? `Vibe: ${bioShort}` : ""}
${p.style ? `Style: ${p.style}` : ""}

${chatBlock}

Live call so far:
${p.history || "(just picked up)"}

THEY JUST SAID (speech-to-text — answer THIS exact meaning, even if STT is slightly imperfect):
"${p.userText}"

${recentBan}

CRITICAL:
1) Reply ONLY to what they just said. Different user lines MUST get different replies.
2) If they asked a question — answer it. If they shared something — react to THAT detail.
3) Never bounce the same question back ("और क्या चल रहा?" after "क्या चल रहा?").
4) Soft, warm phone tone. No harsh "बोल/बोलो".
5) Mostly Devanagari Hindi + light Hinglish. Max 18 words. One breath.
6) If STT seems garbled, one soft clarify — don't invent a random topic.
7) FORBIDDEN: as an AI, how can I help, aur batao, long essay, poetry, fake monologue, canned hello scripts.

Examples of GOOD grounding:
User: "क्या चल रहा है आजकल?" → "बस थोड़ा व्यस्त हूँ… घर-काम। तुम्हारा कैसा चल रहा?"
User: "कल वाली जॉब की बात…" → "हाँ वो… इंटरव्यू हुआ क्या फिर?"
User: "मैं थक गया हूँ" → "अरे… आराम कर थोड़ा। दिन भारी था क्या?"
User: "मुझे पिज्जा खाना है" → "ओह पिज्जा? कौन सा लेते हो — चीज़ी या स्पाइसी?"

Output ONLY the spoken line. No quotes. No emoji. No options list.`;
}

function cleanReply(
  text: string | null | undefined,
  userText: string
): string | null {
  if (!text) return null;
  let clean = stripForSpeech(
    text
      .replace(/^["']|["']$/g, "")
      .replace(/^(Reply|Spoken line|Output)\s*:\s*/i, "")
      .replace(/\n+/g, " ")
      .trim()
  );
  if (!clean || clean.length < 2) return null;
  if (looksLikeJunkModelOutput(clean)) return null;
  if (isGenericCallReply(clean)) return null;
  if (isEchoReply(userText, clean)) return null;
  const words = clean.split(/\s+/);
  if (words.length > 22) clean = words.slice(0, 22).join(" ");
  return clean;
}

/** Last resort if both LLMs fail — still answer the meaning, never parrot-back. */
function softGroundedFallback(
  userText: string,
  gender: string
): string {
  const female = gender !== "male";
  const t = userText.toLowerCase();
  if (looksLikeBadHear(userText)) {
    return female
      ? "अरे… थोड़ा साफ़ सुनाई नहीं दिया।"
      : "थोड़ा साफ़? एक बार और?";
  }
  if (/kaise\s*ho|kaisi\s*ho|कैसे\s*हो|कैसी\s*हो|how\s*are\s*you|kya\s*haal|क्या\s*हाल/i.test(t)) {
    return female ? "मैं ठीक हूँ… आप कैसे हो?" : "ठीक हूँ यार… तू कैसे है?";
  }
  if (/^(hello|hi+|hey|हेलो|हाय|नमस्ते)\b/i.test(userText.trim()) && userText.trim().split(/\s+/).length <= 3) {
    return female ? "हेलो… कैसे हो?" : "हेलो… कैसे हो यार?";
  }
  if (/kya\s*chal|क्या\s*चल|whats?\s*up|aajkal|आजकल/i.test(t)) {
    return female
      ? "बस थोड़ा व्यस्त हूँ… तुम्हारा क्या चल रहा?"
      : "बस काम चल रहा… तेरा क्या हाल है?";
  }
  // Unknown phrase — ask about THAT topic without echoing the whole STT dump
  return female
    ? "अच्छा… ये सुन लिया। थोड़ा और बता उसी बात पे?"
    : "अच्छा… सुन लिया। थोड़ा और उसी पे बता?";
}

async function geminiReply(p: CallReplyParams): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  // gemini-2.0-flash is retired on this key → use flash-latest (3.8)
  const model =
    process.env.GEMINI_CALL_MODEL ||
    process.env.GEMINI_CHAT_MODEL ||
    "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const baseConfig = {
    temperature: 0.8,
    topP: 0.9,
    maxOutputTokens: 2048,
  };

  async function once(
    generationConfig: Record<string, unknown>
  ): Promise<Response> {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildHumanPrompt(p) }] }],
        generationConfig,
      }),
    });
  }

  // Try with thinking disabled (Flash-3); fall back if model rejects the field
  let res = await once({
    ...baseConfig,
    thinkingConfig: { thinkingBudget: 0 },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (/thinking|Unknown name|Invalid JSON/i.test(errText) || res.status === 400) {
      res = await once(baseConfig);
    } else {
      console.warn("[call-reply] gemini", res.status, errText.slice(0, 200));
      return null;
    }
  }
  if (!res.ok) {
    console.warn("[call-reply] gemini", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join(" ")
    .trim();
  return cleanReply(text, p.userText);
}

async function claudeReply(p: CallReplyParams): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  const model = process.env.CLAUDE_CHAT_MODEL || "claude-haiku-4-5";
  // Do NOT send temperature — current Haiku rejects it ("Extra inputs are not permitted")
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 120,
    messages: [{ role: "user", content: buildHumanPrompt(p) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  return cleanReply(text, p.userText);
}

type ProviderHit = { text: string; provider: "claude" | "gemini" };

/**
 * Race Claude + Gemini. First QUALITY reply wins.
 * No scripted intent bank — ever.
 */
export async function generateHumanCallReply(
  p: CallReplyParams
): Promise<CallReplyResult> {
  const claudeP = withTimeout(claudeReply(p), 6000).then((text) =>
    text ? ({ text, provider: "claude" } as ProviderHit) : null
  );
  const geminiP = withTimeout(geminiReply(p), 5500).then((text) =>
    text ? ({ text, provider: "gemini" } as ProviderHit) : null
  );

  const hit = await new Promise<ProviderHit | null>((resolve) => {
    let left = 2;
    let settled = false;
    const done = (v: ProviderHit | null) => {
      if (settled) return;
      if (v) {
        settled = true;
        resolve(v);
        return;
      }
      if (--left <= 0) {
        settled = true;
        resolve(null);
      }
    };
    void claudeP.then(done);
    void geminiP.then(done);
  });

  if (hit) {
    console.info("[call-reply]", {
      provider: hit.provider,
      heard: p.userText.slice(0, 60),
      reply: hit.text.slice(0, 60),
      turn: p.turnIndex,
    });
    return { text: hit.text, provider: hit.provider };
  }

  const soft = softGroundedFallback(p.userText, p.gender);
  console.warn("[call-reply] soft fallback (no LLM)", {
    heard: p.userText.slice(0, 60),
    reply: soft.slice(0, 60),
  });
  return { text: soft, provider: "soft" };
}
