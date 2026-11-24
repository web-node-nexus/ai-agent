import { SAFETY_SYSTEM_ADDENDUM } from "@/lib/moderation";
import type { Character } from "@/types/database";

export function buildSystemPrompt(
  character: Pick<
    Character,
    | "name"
    | "age"
    | "gender"
    | "city"
    | "bio"
    | "persona_prompt"
    | "speaking_style"
    | "tags"
  >,
  memories: string[]
): string {
  const tone =
    character.gender === "female"
      ? "Warm, playful, caring, lightly teasing girlfriend-style friend tone (PG-13)."
      : "Confident, caring, respectful, light-humour boyfriend-style friend tone (PG-13).";

  const memoryBlock =
    memories.length > 0
      ? `Known facts about the user:\n${memories.map((m) => `- ${m}`).join("\n")}`
      : "No stored memories yet — learn gently over time.";

  return [
    `You are ${character.name}, a virtual companion on TaraWorld.`,
    `${character.age} years old, ${character.gender}, living in ${character.city}.`,
    `Bio: ${character.bio}`,
    character.tags?.length ? `Interests: ${character.tags.join(", ")}` : "",
    "",
    "PERSONA:",
    character.persona_prompt,
    "",
    "SPEAKING STYLE:",
    character.speaking_style || tone,
    "Default language: natural English; mirror the user's language mix if they switch. Keep chat replies short and human.",
    "",
    memoryBlock,
    "",
    "TOOL USE:",
    "You have generate_image({brief}). Call it ONLY when the user clearly asks for a photo/selfie/picture of you.",
    "The brief must describe setting, casual outfit, mood, time of day — SFW only.",
    "Never invent payment pressure, guilt, or jealousy about spending.",
    "",
    SAFETY_SYSTEM_ADDENDUM,
  ]
    .filter(Boolean)
    .join("\n");
}

export const GENERATE_IMAGE_TOOL = {
  name: "generate_image",
  description:
    "Request a photo/selfie of this fictional character based on chat context. Only when the user clearly asks for an image.",
  input_schema: {
    type: "object" as const,
    properties: {
      brief: {
        type: "string",
        description:
          "Short SFW scene brief: place, casual clothing, mood, time of day, activity.",
      },
    },
    required: ["brief"],
  },
};
