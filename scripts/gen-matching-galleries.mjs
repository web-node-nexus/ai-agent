/**
 * Generate 2 matching outfit/angle variants per Indian persona face.
 * Uses the existing image as identity reference so gallery looks like the same person.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const KEY = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
const MODEL =
  env.match(/^GEMINI_IMAGE_MODEL=(.+)$/m)?.[1]?.trim() ||
  "gemini-2.5-flash-image";

if (!KEY) {
  console.error("GEMINI_API_KEY missing");
  process.exit(1);
}

function loadEnvPath(rel) {
  return path.join(root, "public", rel.replace(/^\//, ""));
}

async function variantFromRef(refPath, outPath, gender, label) {
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 50_000) {
    console.log("skip exists", outPath);
    return true;
  }
  const buf = fs.readFileSync(refPath);
  const b64 = buf.toString("base64");
  const mime = refPath.endsWith(".png") ? "image/png" : "image/jpeg";
  const prompt = `Create a NEW photoreal vertical portrait of the EXACT SAME Indian ${gender} shown in the reference image.
Keep the same face identity, age, skin tone, and South Asian / Indian features.
Change only: outfit, slight pose, and camera angle. Casual Indian urban fashion, PG-13, warm smile, soft lighting, dating-app cover style.
No text, no watermark. Must look like the same person as the reference — not a different person. Variation: ${label}.`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mime, data: b64 } },
        ],
      },
    ],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      MODEL
    )}:generateContent?key=${encodeURIComponent(KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts || [];
  let data = null;
  let outMime = "image/png";
  for (const p of parts) {
    const d = p.inlineData?.data || p.inline_data?.data;
    const m = p.inlineData?.mimeType || p.inline_data?.mime_type;
    if (d) {
      data = d;
      outMime = m || outMime;
    }
  }
  if (!data) {
    console.error("FAIL", outPath, json.error?.message || "no image");
    return false;
  }
  const ext = outMime.includes("jpeg") || outMime.includes("jpg") ? "jpg" : "png";
  const finalPath = outPath.replace(/\.(png|jpg|jpeg)$/i, `.${ext}`);
  fs.writeFileSync(finalPath, Buffer.from(data, "base64"));
  console.log("OK", finalPath, fs.statSync(finalPath).size);
  return true;
}

const seeds = [
  ["aanya", "female"],
  ["riya", "female"],
  ["naina", "female"],
  ["meher", "female"],
  ["arjun", "male"],
  ["kabir", "male"],
  ["rohan", "male"],
  ["vihaan", "male"],
];

const stock = [];
for (let i = 1; i <= 8; i++) {
  const n = String(i).padStart(2, "0");
  stock.push([`indian/f${n}.png`, "female", `f${n}`]);
  stock.push([`indian/m${n}.png`, "male", `m${n}`]);
}

async function main() {
  // Seed characters: real matching refs (overwrite identical copies)
  for (const [slug, gender] of seeds) {
    const cover = loadEnvPath(`characters/${slug}/cover.jpg`);
    if (!fs.existsSync(cover)) {
      console.error("missing", cover);
      continue;
    }
    for (const ref of ["ref1", "ref2", "ref3"]) {
      const out = loadEnvPath(`characters/${slug}/${ref}.jpg`);
      // Always regenerate so refs aren't byte-identical to cover
      if (fs.existsSync(out)) fs.unlinkSync(out);
      await variantFromRef(cover, out, gender, ref);
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  // Indian stock: b + c matching variants
  for (const [rel, gender, id] of stock) {
    const cover = loadEnvPath(`characters/${rel}`);
    if (!fs.existsSync(cover)) continue;
    for (const suf of ["b", "c"]) {
      const out = loadEnvPath(`characters/indian/${id}${suf}.png`);
      await variantFromRef(cover, out, gender, suf);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
