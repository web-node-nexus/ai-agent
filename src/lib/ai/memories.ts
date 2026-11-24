import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";

const EXTRACT_SYSTEM = `You extract durable, non-sensitive memory facts about the USER from a chat with an AI companion.
Return ONLY a JSON array of short strings (max 8 items). Rules:
- Only lasting preferences, life facts, names of people/pets they mention, hobbies, city, job, relationship status if they stated it.
- No passwords, OTPs, card numbers, IDs, addresses, phone numbers, or medical diagnoses.
- No sexual/explicit content.
- Deduplicate; skip trivial one-off remarks.
- If nothing durable, return [].`;

export async function extractAndSaveMemories(params: {
  userId: string;
  characterId: string;
  conversationId: string;
}): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const service = createServiceClient();
  const { data: messages } = await service
    .from("messages")
    .select("role, content, kind")
    .eq("conversation_id", params.conversationId)
    .eq("kind", "text")
    .order("created_at", { ascending: false })
    .limit(40);

  if (!messages?.length) return;

  const transcript = [...messages]
    .reverse()
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(0, 12_000);

  const { data: existing } = await service
    .from("memories")
    .select("content")
    .eq("user_id", params.userId)
    .eq("character_id", params.characterId)
    .limit(50);

  const existingSet = new Set((existing ?? []).map((m) => m.content.toLowerCase()));

  const anthropic = new Anthropic({ apiKey });
  const model =
    process.env.CLAUDE_UTILITY_MODEL ||
    process.env.CLAUDE_CHAT_MODEL ||
    "claude-haiku-4-5";

  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Existing memories:\n${[...existingSet].join("\n") || "(none)"}\n\nTranscript:\n${transcript}`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let facts: string[] = [];
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) {
      facts = JSON.parse(text.slice(start, end + 1)) as string[];
    }
  } catch {
    return;
  }

  const rows = facts
    .filter((f) => typeof f === "string")
    .map((f) => f.trim())
    .filter((f) => f.length > 3 && f.length < 280)
    .filter((f) => !existingSet.has(f.toLowerCase()))
    .slice(0, 8)
    .map((content) => ({
      user_id: params.userId,
      character_id: params.characterId,
      content,
    }));

  if (!rows.length) return;

  await service.from("memories").upsert(rows, {
    onConflict: "user_id,character_id,content",
    ignoreDuplicates: true,
  });
}

export async function loadMemoriesForPrompt(
  userId: string,
  characterId: string,
  limit = 20
): Promise<string> {
  const service = createServiceClient();
  const { data } = await service
    .from("memories")
    .select("content")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data?.length) return "";
  return data
    .map((m) => `- ${m.content}`)
    .reverse()
    .join("\n");
}
