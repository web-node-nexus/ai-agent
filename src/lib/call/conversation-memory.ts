/** Call transcript + prior chat context so replies stay grounded. */

type Turn = { role: "user" | "assistant"; text: string };

type SessionMemory = {
  turns: Turn[];
  /** Recent chat lines (already formatted), loaded once at call start */
  chatContext: string;
  /** How many assistant replies already spoken on this call */
  assistantCount: number;
};

const store = new Map<string, SessionMemory>();

function ensure(sessionId: string): SessionMemory {
  let m = store.get(sessionId);
  if (!m) {
    m = { turns: [], chatContext: "", assistantCount: 0 };
    store.set(sessionId, m);
  }
  return m;
}

export function getCallTurns(sessionId: string): Turn[] {
  return ensure(sessionId).turns;
}

export function getChatContext(sessionId: string): string {
  return ensure(sessionId).chatContext;
}

export function getAssistantCount(sessionId: string): number {
  return ensure(sessionId).assistantCount;
}

/** Seed prior chat so the call can continue those topics. */
export function seedCallFromChat(
  sessionId: string,
  messages: Array<{ role: string; content: string }>
) {
  const m = ensure(sessionId);
  const lines = messages
    .filter((x) => x.content?.trim() && x.role !== "system")
    .slice(-10)
    .map((x) => {
      const who = x.role === "user" || x.role === "human" ? "User" : "Companion";
      const text = x.content.replace(/\s+/g, " ").trim().slice(0, 160);
      return `${who}: ${text}`;
    });
  m.chatContext = lines.join("\n");
}

export function pushCallTurn(
  sessionId: string,
  role: "user" | "assistant",
  text: string
) {
  const m = ensure(sessionId);
  m.turns.push({ role, text: text.trim() });
  m.turns = m.turns.slice(-14);
  if (role === "assistant") m.assistantCount += 1;
}

export function clearCallTurns(sessionId: string) {
  store.delete(sessionId);
}

export function stripForSpeech(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[*_#`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
