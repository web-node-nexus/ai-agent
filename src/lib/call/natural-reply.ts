/** Grounded Hindi phone replies — Latin + Devanagari, real-friend tone. */

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fold(s: string) {
  return norm(s)
    .replace(/सो|तो|तोह/g, "toh ")
    .replace(/कैसे|केसे|कैसी|केसी/g, "kaise ")
    .replace(/\bहो\b|हैं|है(?!\w)/g, "ho ")
    .replace(/क्या/g, "kya ")
    .replace(/हालचाल|हाल/g, "haal ")
    .replace(/नमस्ते|नमस्कार/g, "namaste ")
    .replace(/हेलो|हैलो|हेल्लो/g, "hello ")
    .replace(/आप/g, "aap ")
    .replace(/मैं|मै/g, "main ")
    .replace(/ठीक/g, "theek ")
    .replace(/प्यार|प्रेम/g, "pyaar ")
    .replace(/याद/g, "yaad ")
    .replace(/दुखी|उदास|परेशान|टेंशन/g, "dukhi ")
    .replace(/भूख|खाना/g, "khana ")
    .replace(/कहाँ|कहा/g, "kahan ")
    .replace(/घर/g, "ghar ")
    .replace(/अलविदा|बाय/g, "bye ")
    .replace(/मूड|मुड/g, "mood ")
    .replace(/नॉटी|नाटी|नौटी/g, "naughty ")
    .replace(/\s+/g, " ")
    .trim();
}

const pick = (arr: string[]) =>
  arr[Math.floor(Math.random() * arr.length)]!;

export function localHindiReply(params: {
  userText: string;
  name: string;
  gender: string;
}): string | null {
  const raw = params.userText.trim();
  const t = fold(raw);
  const blob = `${t} ${raw}`.toLowerCase();
  if (!t && !raw) return null;
  const female = params.gender !== "male";

  if (
    /kaise\s*ho|kaisi\s*ho|how are you|kya\s*haal|kya\s*chal|sab\s*theek|haal\s*chal|कैसे\s*हो|कैसी\s*हो|क्या\s*हाल/i.test(
      blob
    )
  ) {
    return pick(
      female
        ? [
            "Main theek hoon yaar — tum sunao?",
            "Bas chill, tum batao aaj kaisa din?",
            "Haan theek — mood kaisa hai tera?",
          ]
        : [
            "Theek hoon bhai — tum sunao?",
            "Bas chal raha hai — tum batao?",
            "Haan theek — aaj kya scene?",
          ]
    );
  }

  if (
    /^(hello|hi|hey|namaste|hola|yo|hel+o+)\b/i.test(t) ||
    /\b(namaste|hello|hi hi|हेलो|नमस्ते)\b/i.test(blob)
  ) {
    return pick([
      `Arre haan, ${params.name} — bolo?`,
      `Hello hello, main ${params.name} — kya haal?`,
      `Haan bol, ${params.name} yahin hoon.`,
    ]);
  }

  if (/naughty|notty|नॉटी|horny|masti|flirt|tease|romantic/i.test(blob)) {
    return pick(
      female
        ? [
            "हेहे नॉटी मूड है क्या जान? मुस्कान आ गई मेरी…",
            "अरे प्यार से छेड़ रहा है? अच्छा लग रहा।",
            "हम्म… थोड़ा सा नॉटी चल रहा, और बता।",
          ]
        : [
            "हेहे मस्ती आ गई — सॉफ्ट नॉटी मूड है मेरा भी।",
            "छेड़ रहा है तू? स्माइल आ गई यार।",
            "हम्म फ्लर्ट चल रहा — और सुना।",
          ]
    );
  }

  if (/mood|मूड|feeling|feel ho/i.test(blob)) {
    return pick(
      female
        ? [
            "Hmm mood change — kya feel ho raha exact?",
            "Aaj heavy hai kya? Bolo, sun rahi hoon.",
            "Mood sun liya — ab kya chahiye tujhe?",
          ]
        : [
            "Mood samajh gaya — exact kya chal raha?",
            "Heavy din lag raha? Bolo.",
            "Vibe change — ab kya plan?",
          ]
    );
  }

  if (/kya kar|busy ho|क्या कर/i.test(blob)) {
    return pick(
      female
        ? [
            "Abhi free thi, bas tumse baat — tum kya kar rahe?",
            "Kuch nahi, call pe hoon — tum batao?",
          ]
        : [
            "Free tha, bas call pe — tum?",
            "Kuch khas nahi — tum kya kar rahe?",
          ]
    );
  }

  if (/sun rahe|sun rahi|are you there|bol rahe|yahin/i.test(t)) {
    return pick(["Haan haan yahin — bolo.", "Sun raha hoon, bol na.", "Haan bol, cut nahi hua."]);
  }

  if (
    /^(nahi|no|nope|kuch nahi|nothing|chup)$/i.test(t) ||
    (/^(nahi|नहीं)\b/i.test(raw) && raw.length < 12)
  ) {
    return pick([
      "Theek… jab mann kare bolo.",
      "OK, pressure nahi — main yahin.",
      "Haan theek, baad mein bhi chalega.",
    ]);
  }

  if (/pyaar|love you|miss you|yaad/i.test(blob)) {
    return pick(
      female
        ? [
            "Aww soft laga — main bhi soch rahi thi.",
            "Hehe yaad aa gayi? Cute.",
            "Dil soft ho gaya — main bhi miss karti.",
          ]
        : [
            "Soft laga — main bhi soch raha tha.",
            "Yaad? Hehe theek hai.",
            "Cute bola — main bhi soch raha.",
          ]
    );
  }

  if (/dukhi|sad|tension|pareshaan|thak|udaas|lonely/i.test(blob)) {
    return pick(
      female
        ? [
            "Arre heavy lag raha — bolo, sunungi.",
            "Tension hai kya? Main yahin hoon.",
            "Thak gaye? Thoda batao kya hua.",
          ]
        : [
            "Heavy din? Bolo sununga.",
            "Tension mat lo — bata kya hua.",
            "Thak gaye lagte ho — kya scene?",
          ]
    );
  }

  if (/khana|hungry|bhook/i.test(blob)) {
    return pick([
      "Arre bhook? Aaj kya khaya?",
      "Snack soch rahi thi — tumne kya khaya?",
      "Khana ka plan? Main bhi soch rahi.",
    ]);
  }

  if (/kahan|where are you|city|ghar/i.test(blob)) {
    return pick([
      "Ghar pe hi — tum kahan se?",
      "Abhi ghar — tum batao city?",
      "Yahin ghar — tum kahan ho?",
    ]);
  }

  if (/naam|name kya|who are you|kaun ho/i.test(blob)) {
    return pick(
      female
        ? [
            `Main ${params.name} — tumhara naam?`,
            `${params.name} bol rahi… tum kaun?`,
          ]
        : [
            `Main ${params.name} — tumhara naam?`,
            `${params.name} bol raha… tum kaun?`,
          ]
    );
  }

  if (/\b(bye|alvida|chalta|good night|gn)\b/i.test(blob)) {
    return pick(
      female
        ? [
            "OK take care — baad mein call karna.",
            "Bye bye, so jao soft.",
            "Theek, baad mein baat.",
          ]
        : [
            "OK yaar take care.",
            "Bye, baad mein call.",
            "Chal, baad mein milte.",
          ]
    );
  }

  if (
    /^(acha|accha|sahi|theek|ok|okay|hmm+|haan|han)\b/i.test(t) &&
    t.length < 18
  ) {
    return pick([
      "Haan… ab kya scene?",
      "Hmm, aage bolo.",
      "OK — aur kya chal raha?",
    ]);
  }

  if (/bol|कह|kaha|bataya|suna/i.test(blob)) {
    return pick(
      female
        ? [
            "Haan sun liya — thoda aur batao uspe.",
            "OK got it — phir kya hua?",
            "Sun liya — ab mood kaisa?",
          ]
        : [
            "Sun liya — aage kya?",
            "OK — phir kya scene?",
            "Haan — uske baad?",
          ]
    );
  }

  // Last resort — still human, never "Interesting / aur batao"
  return pick(
    female
      ? [
          "Arre yeh to alag baat — thoda aur bata?",
          "Hmm interesting vibe — exact kya scene?",
          "OK wait, yeh clear nahi — short mein bolo?",
          "Hehe OK — ab dil se bata kya chahiye.",
        ]
      : [
          "Arre alag scene — thoda aur?",
          "Hmm — exact kya scene hai?",
          "OK wait short mein bolo?",
          "Haan — ab seedha bata kya chahiye.",
        ]
  );
}

/** True if reply is the lazy generic loop users hate. */
export function isGenericCallReply(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /samajh gay[ai]\s*[—\-–]?\s*aur batao/.test(t) ||
    /thoda clear bolo/.test(t) ||
    /haan\?\s*thoda clear/.test(t) ||
    /dil ki baat/.test(t) ||
    /^interesting\s*[—\-–]/.test(t) ||
    /as an ai/.test(t) ||
    /i('m| am) an ai/.test(t) ||
    /^(हाँ|haan)\s*(बोलो|bolo)\s*[—\-–]?\s*(सुन|sun)/i.test(text.trim()) ||
    /सुन लिया\s*[—\-–]?\s*आगे बोलो/.test(text) ||
    /aur batao/.test(t) ||
    /main sun rah[ai] hoon\.?$/.test(t) ||
    /how can i help/.test(t) ||
    /बात कर सकते हैं/.test(text)
  );
}
