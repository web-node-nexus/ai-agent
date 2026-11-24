/**
 * Call reply brain — real LLM conversation only.
 * Always answer WHAT the user just said. No script bank.
 */

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
        console.warn("[call-reply] provider error", String(err).slice(0, 180));
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

function buildPrompt(p: CallReplyParams, simple = false) {
  const female = p.gender !== "male";
  const cityBit = p.city || "India";
  if (simple) {
    return `You are ${p.name}, a real ${female ? "girl" : "guy"} from ${cityBit} on a phone call with a friend.
Friend just said (speech-to-text may be imperfect): "${p.userText}"
Reply in natural spoken Hindi (Devanagari), max 16 words, answering THAT line only.
No scripts. No English essay. No emoji. Output only the spoken reply.`;
  }

  const recentBan =
    p.recentAssistant.length > 0
      ? `Do not repeat:\n- ${p.recentAssistant.slice(-3).join("\n- ")}`
      : "";
  const chatBlock = p.chatContext?.trim()
    ? `Earlier chat (only if relevant):\n${p.chatContext.slice(0, 500)}`
    : "";

  return `You are ${p.name} from ${cityBit} on a live phone call.
You are a real soft-spoken ${female ? "Indian girl" : "Indian guy"} talking to a friend — not a bot, not customer care, not a script.

Persona (don't recite): ${(p.persona || "").slice(0, 220)}
${p.bio ? `Vibe: ${p.bio.slice(0, 100)}` : ""}
${p.style ? `Style: ${p.style}` : ""}
${chatBlock}

Call so far:
${p.history || "(just started)"}

Friend JUST said (STT — answer the meaning even if spelling is messy):
"${p.userText}"

${recentBan}

Rules:
- Think about what they meant, then reply to THAT.
- If they asked how you are → say how you are, then ask back once.
- If they shared news/feeling/place/food → react to the detail.
- Never ignore their words. Never give a random canned line.
- Soft Hindi Devanagari + light Hinglish. Max 18 words. One breath.
- Forbidden: "as an AI", "aur batao", "interesting", long essays, poetry.

Output ONLY the spoken line.`;
}

function cleanReply(text: string | null | undefined): string | null {
  if (!text) return null;
  let clean = stripForSpeech(
    text
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/^(Reply|Spoken line|Output|Assistant)\s*:\s*/i, "")
      .replace(/\n+/g, " ")
      .trim()
  );
  if (!clean || clean.length < 2) return null;
  if (/^(options?|as an ai|i am an ai)\b/i.test(clean)) return null;
  if (/^[\{\[]/.test(clean)) return null;
  const words = clean.split(/\s+/);
  if (words.length > 24) clean = words.slice(0, 24).join(" ");
  return clean;
}

async function claudeOnce(
  p: CallReplyParams,
  simple: boolean
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[call-reply] claude missing ANTHROPIC_API_KEY");
    return null;
  }
  const model = process.env.CLAUDE_CHAT_MODEL || "claude-haiku-4-5-20251001";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 160,
      messages: [{ role: "user", content: buildPrompt(p, simple) }],
    }),
  });
  if (!res.ok) {
    console.warn(
      "[call-reply] claude",
      res.status,
      (await res.text().catch(() => "")).slice(0, 200)
    );
    return null;
  }
  const json = (await res.json().catch(() => ({}))) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = (json.content || [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text || "")
    .join(" ")
    .trim();
  return cleanReply(text);
}

async function geminiOnce(p: CallReplyParams): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("[call-reply] gemini missing GEMINI_API_KEY");
    return null;
  }
  // Prefer models this key can reach (2.0-flash is retired)
  const model =
    process.env.GEMINI_CALL_MODEL ||
    process.env.GEMINI_CHAT_MODEL ||
    "gemini-3.8-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [{ parts: [{ text: buildPrompt(p, false) }] }],
    generationConfig: {
      temperature: 0.85,
      topP: 0.9,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 400 && /thinking/i.test(errText)) {
      const { thinkingConfig: _, ...rest } = body.generationConfig as {
        thinkingConfig?: unknown;
        temperature: number;
        topP: number;
        maxOutputTokens: number;
      };
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: body.contents,
          generationConfig: rest,
        }),
      });
    } else {
      console.warn("[call-reply] gemini", res.status, errText.slice(0, 200));
      return null;
    }
  }

  if (!res.ok) {
    console.warn(
      "[call-reply] gemini",
      res.status,
      (await res.text().catch(() => "")).slice(0, 200)
    );
    return null;
  }

  const json = (await res.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join(" ")
    .trim();
  return cleanReply(text);
}

/**
 * Claude first (real thinking), then Gemini, then simple Claude retry.
 * Soft line only if every model is down — still not a topic script bank.
 */
export async function generateHumanCallReply(
  p: CallReplyParams
): Promise<CallReplyResult> {
  // 1) Claude — primary conversational brain
  const claude = await withTimeout(claudeOnce(p, false), 9000);
  if (claude) {
    console.info("[call-reply]", {
      provider: "claude",
      heard: p.userText.slice(0, 80),
      reply: claude.slice(0, 80),
      turn: p.turnIndex,
    });
    return { text: claude, provider: "claude" };
  }

  // 2) Gemini backup
  const gemini = await withTimeout(geminiOnce(p), 8000);
  if (gemini) {
    console.info("[call-reply]", {
      provider: "gemini",
      heard: p.userText.slice(0, 80),
      reply: gemini.slice(0, 80),
      turn: p.turnIndex,
    });
    return { text: gemini, provider: "gemini" };
  }

  // 3) Simple Claude retry (shorter prompt — higher success when first fails)
  const retry = await withTimeout(claudeOnce(p, true), 9000);
  if (retry) {
    console.info("[call-reply]", {
      provider: "claude",
      heard: p.userText.slice(0, 80),
      reply: retry.slice(0, 80),
      turn: p.turnIndex,
      via: "retry",
    });
    return { text: retry, provider: "claude" };
  }

  // Absolute last resort — ask them to repeat, NEVER invent a random topic script
  const soft = looksLikeBadHear(p.userText)
    ? p.gender !== "male"
      ? "अरे… थोड़ा साफ़ सुनाई नहीं दिया।"
      : "थोड़ा साफ़? एक बार और?"
    : p.gender !== "male"
      ? "एक सेकंड… नेट थोड़ा अटका। वही बात दोबारा बोलो?"
      : "एक सेकंड… नेट अटका। वही बात दोबारा बोल?";

  console.error("[call-reply] ALL LLMs FAILED", {
    heard: p.userText.slice(0, 80),
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    hasGemini: Boolean(process.env.GEMINI_API_KEY),
    claudeModel: process.env.CLAUDE_CHAT_MODEL,
    geminiModel: process.env.GEMINI_CALL_MODEL || process.env.GEMINI_CHAT_MODEL,
  });
  return { text: soft, provider: "soft" };
}
