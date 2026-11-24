import { GoogleGenAI, Modality } from "@google/genai";

export type GeneratedImageResult = {
  bytes: Buffer;
  mimeType: string;
};

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey });
}

/**
 * Generate a SFW character image via Gemini (Nano Banana / image models).
 * Includes optional reference image URLs when fetchable.
 */
export async function generateImage(params: {
  brief: string;
  characterName: string;
  characterBio?: string;
  referenceImageUrls?: string[];
}): Promise<GeneratedImageResult> {
  const model =
    process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
  const ai = getClient();

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> =
    [];

  const prompt = [
    `Create a single photorealistic portrait/lifestyle image of the fictional character "${params.characterName}".`,
    params.characterBio ? `Character: ${params.characterBio}` : "",
    `User brief (SFW only): ${params.brief}`,
    "Constraints: PG-13, fully clothed, no lingerie/swimwear/suggestive poses, no real celebrities, no minors, no gore.",
    "Match the character identity from any reference images provided.",
  ]
    .filter(Boolean)
    .join("\n");

  parts.push({ text: prompt });

  const refs = (params.referenceImageUrls ?? []).slice(0, 3);
  for (const url of refs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const mimeType = res.headers.get("content-type") || "image/jpeg";
      if (!mimeType.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 4_000_000) continue;
      parts.push({
        inlineData: {
          mimeType,
          data: buf.toString("base64"),
        },
      });
    } catch {
      // skip unreadable refs
    }
  }

  // Prefer generateContent with IMAGE modality (Gemini image models / Nano Banana)
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const candidates = response.candidates ?? [];
    for (const c of candidates) {
      for (const part of c.content?.parts ?? []) {
        const inline = part.inlineData;
        if (inline?.data) {
          return {
            bytes: Buffer.from(inline.data, "base64"),
            mimeType: inline.mimeType || "image/png",
          };
        }
      }
    }
  } catch (err) {
    console.warn("generateContent image failed, trying generateImages", err);
  }

  // Fallback: Imagen-style generateImages (text-only prompt)
  const imagen = await ai.models.generateImages({
    model,
    prompt,
    config: { numberOfImages: 1 },
  });

  const imageBytes = imagen.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) {
    throw new Error("Image generation returned no image");
  }

  return {
    bytes: Buffer.from(imageBytes, "base64"),
    mimeType: "image/png",
  };
}
