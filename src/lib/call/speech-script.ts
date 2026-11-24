/**
 * Prepare spoken lines for TTS.
 * Roman Hinglish often sounds robotic on TTS; Devanagari reads more natural.
 */

const WORD_MAP: Array<[RegExp, string]> = [
  [/\bmain\b/gi, "मैं"],
  [/\bmein\b/gi, "में"],
  [/\bhai\b/gi, "है"],
  [/\bhain\b/gi, "हैं"],
  [/\bhoon\b/gi, "हूँ"],
  [/\bhun\b/gi, "हूँ"],
  [/\bho\b/gi, "हो"],
  [/\bkya\b/gi, "क्या"],
  [/\bkaise\b/gi, "कैसे"],
  [/\bkaisi\b/gi, "कैसी"],
  [/\bbatao\b/gi, "बताओ"],
  [/\bbata\b/gi, "बता"],
  [/\bbolo\b/gi, "बोलो"],
  [/\bbol\b/gi, "बोल"],
  [/\brahi\b/gi, "रही"],
  [/\braha\b/gi, "रहा"],
  [/\brahe\b/gi, "रहे"],
  [/\bsun\b/gi, "सुन"],
  [/\bsuno\b/gi, "सुनो"],
  [/\btheek\b/gi, "ठीक"],
  [/\bacha\b/gi, "अच्छा"],
  [/\baccha\b/gi, "अच्छा"],
  [/\byaar\b/gi, "यार"],
  [/\barre\b/gi, "अरे"],
  [/\bahaan\b/gi, "हाँ"],
  [/\bhaan\b/gi, "हाँ"],
  [/\bhan\b/gi, "हाँ"],
  [/\bnahi\b/gi, "नहीं"],
  [/\bnahin\b/gi, "नहीं"],
  [/\bplease\b/gi, "प्लीज़"],
  [/\bhello\b/gi, "हेलो"],
  [/\bhi\b/gi, "हाय"],
  [/\bbye\b/gi, "बाय"],
  [/\bmood\b/gi, "मूड"],
  [/\bscene\b/gi, "सीन"],
  [/\bdil\b/gi, "दिल"],
  [/\bbaat\b/gi, "बात"],
  [/\babhi\b/gi, "अभी"],
  [/\baaj\b/gi, "आज"],
  [/\btum\b/gi, "तुम"],
  [/\btumhe\b/gi, "तुम्हें"],
  [/\btumhara\b/gi, "तुम्हारा"],
  [/\btumhari\b/gi, "तुम्हारी"],
  [/\bmera\b/gi, "मेरा"],
  [/\bmeri\b/gi, "मेरी"],
  [/\bmere\b/gi, "मेरे"],
  [/\byahin\b/gi, "यहीं"],
  [/\byahan\b/gi, "यहाँ"],
  [/\bkahan\b/gi, "कहाँ"],
  [/\bghar\b/gi, "घर"],
  [/\bpe\b/gi, "पे"],
  [/\bpar\b/gi, "पर"],
  [/\bauk\b/gi, "ओके"],
  [/\bok\b/gi, "ओके"],
  [/\bokay\b/gi, "ओके"],
  [/\bthoda\b/gi, "थोड़ा"],
  [/\baur\b/gi, "और"],
  [/\bphir\b/gi, "फिर"],
  [/\bab\b/gi, "अब"],
  [/\bbas\b/gi, "बस"],
  [/\bsoft\b/gi, "सॉफ्ट"],
  [/\bnoughty\b/gi, "नॉटी"],
  [/\bnaughty\b/gi, "नॉटी"],
  [/\bhehe\b/gi, "हेहे"],
  [/\bhmm+\b/gi, "हम्म"],
  [/\bna\b/gi, "ना"],
];

/** True if string already has substantial Devanagari. */
export function hasDevanagari(text: string): boolean {
  const m = text.match(/[\u0900-\u097F]/g);
  return (m?.length ?? 0) >= Math.max(3, Math.floor(text.length * 0.25));
}

/**
 * Soft roman→Devanagari for TTS. Keeps unknown English words (names) as-is.
 */
export function toSpeechScript(text: string): string {
  const raw = text.trim();
  if (!raw) return raw;
  if (hasDevanagari(raw)) return raw;

  let out = ` ${raw} `;
  for (const [re, hi] of WORD_MAP) {
    out = out.replace(re, hi);
  }
  return out.replace(/\s+/g, " ").trim();
}
