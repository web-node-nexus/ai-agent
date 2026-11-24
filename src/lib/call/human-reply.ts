/**
 * Call reply brain — always answer WHAT the user said (LLM-first).
 * Intent bank is emergency fallback only when models fail / echo.
 */

import Anthropic from "@anthropic-ai/sdk";
import { matchCallIntent } from "@/lib/call/call-intents";
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(t);
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

THEY JUST SAID (speech-to-text — answer THIS, even if slightly imperfect):
"${p.userText}"

${recentBan}

CRITICAL:
1) Reply to the MEANING of their line. If they asked something — answer it. If they shared something — react to THAT.
2) Never bounce the same question back ("और क्या चल रहा?" after "क्या चल रहा?").
3) Soft, warm phone tone. No harsh "बोल/बोलो".
4) Mostly Devanagari Hindi + light Hinglish. Max 18 words. One breath.
5) If STT seems garbled, one soft clarify — don't invent a random topic.
6) FORBIDDEN: as an AI, how can I help, aur batao, long essay, poetry, fake monologue.

Examples of GOOD grounding:
User: "क्या चल रहा है आजकल?" → "बस थोड़ा व्यस्त हूँ… घर-काम। तुम्हारा कैसा चल रहा?"
User: "कल वाली जॉब की बात…" → "हाँ वो… इंटरव्यू हुआ क्या फिर?"
User: "मैं थक गया हूँ" → "अरे… आराम कर थोड़ा। दिन भारी था क्या?"

Output ONLY the spoken line. No quotes. No emoji.`;
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
      .trim()
  );
  if (!clean || clean.length < 2) return null;
  if (isGenericCallReply(clean)) return null;
  if (isEchoReply(userText, clean)) return null;
  const words = clean.split(/\s+/);
  if (words.length > 20) clean = words.slice(0, 20).join(" ");
  return clean;
}

function emergencyFallback(
  userText: string,
  gender: string,
  name: string,
  city: string | null
): string {
  // Last resort only — prefer intent match, else soft generic (NOT echo)
  const hit = matchCallIntent(userText, { name, gender, city });
  if (hit) return hit.reply;
  if (looksLikeBadHear(userText)) {
    return gender !== "male"
      ? "अरे… थोड़ा साफ़ सुनाई नहीं दिया।"
      : "थोड़ा साफ़? एक बार और?";
  }
  return gender !== "male"
    ? "अच्छा… ये समझ गई। तुम्हारा क्या ख्याल है?"
    : "अच्छा… समझ गया। तेरा क्या ख्याल है?";
}

async function geminiReply(p: CallReplyParams): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_CHAT_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildHumanPrompt(p) }] }],
      generationConfig: {
        temperature: 0.75,
        topP: 0.9,
        maxOutputTokens: 512,
      },
    }),
  });
  if (!res.ok) {
    console.warn("[call-reply] gemini", res.status);
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
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 80,
    temperature: 0.7,
    messages: [{ role: "user", content: buildHumanPrompt(p) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  return cleanReply(text, p.userText);
}

function firstText(
  promises: Array<Promise<string | null>>
): Promise<string | null> {
  return new Promise((resolve) => {
    let left = promises.length;
    if (!left) {
      resolve(null);
      return;
    }
    for (const p of promises) {
      void p.then((v) => {
        if (v) resolve(v);
        else if (--left <= 0) resolve(null);
      });
    }
  });
}

/**
 * LLM-first: react to whatever the user said.
 * Intent bank only if both models fail / return echo junk.
 */
export async function generateHumanCallReply(
  p: CallReplyParams
): Promise<string> {
  if (looksLikeBadHear(p.userText)) {
    return emergencyFallback(p.userText, p.gender, p.name, p.city);
  }

  // Give models enough time to actually answer (instant script removed)
  let reply = await firstText([
    withTimeout(claudeReply(p), 2800),
    withTimeout(geminiReply(p), 2500),
  ]);

  if (reply && isEchoReply(p.userText, reply)) {
    console.warn("[call-reply] echo rejected", reply.slice(0, 40));
    reply = null;
  }

  if (!reply || isGenericCallReply(reply)) {
    reply = emergencyFallback(p.userText, p.gender, p.name, p.city);
  }

  console.info("[call-reply]", {
    heard: p.userText.slice(0, 60),
    reply: reply.slice(0, 60),
    turn: p.turnIndex,
  });
  return reply;
}
