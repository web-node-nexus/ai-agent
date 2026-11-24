/** Hindi spoken audio via browser — always-on backup so the call never stays silent. */

export function pickHindiVoice(
  gender: "male" | "female" | string | null | undefined
): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const wantFemale = gender !== "male";
  const hi = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith("hi") ||
      /hindi|हिन्दी|lekha|meera|neerja|swara|raveena/i.test(v.name)
  );

  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    const n = v.name.toLowerCase();
    if (v.lang.toLowerCase().startsWith("hi")) s += 5;
    if (/google|microsoft|premium|natural|enhanced/i.test(n)) s += 3;
    if (wantFemale && /female|lekha|meera|neerja|swara|heera|zira|woman/i.test(n))
      s += 4;
    if (!wantFemale && /male|ravi|prabhat|hemant|david|mark|man/i.test(n)) s += 4;
    if (wantFemale && /male|ravi|david|mark/i.test(n)) s -= 3;
    if (!wantFemale && /female|lekha|meera|zira/i.test(n)) s -= 3;
    return s;
  };

  const pool = (hi.length ? hi : voices)
    .slice()
    .sort((a, b) => score(b) - score(a));
  return pool[0] ?? null;
}

export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const ready = window.speechSynthesis.getVoices();
    if (ready.length) {
      resolve(ready);
      return;
    }
    const done = () => {
      resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.onvoiceschanged = null;
    };
    window.speechSynthesis.onvoiceschanged = done;
    window.setTimeout(done, 700);
  });
}

/** Promise-based speak — resolves when utterance ends (or fails). */
export async function speakHindiAsync(
  text: string,
  gender: "male" | "female" | string | null | undefined
): Promise<boolean> {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  await ensureVoicesLoaded();

  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel();
      // Chrome needs a beat after cancel or speak is a no-op
      window.setTimeout(() => {
        try {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = "hi-IN";
          // Softer human pacing (browser TTS is backup only)
          utter.rate = 0.88;
          utter.pitch = gender === "male" ? 0.92 : 1.02;
          utter.volume = 1;
          const voice = pickHindiVoice(gender);
          if (voice) {
            utter.voice = voice;
            utter.lang = voice.lang || "hi-IN";
          }
          let settled = false;
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            window.clearInterval(keepAlive);
            resolve(ok);
          };
          utter.onend = () => finish(true);
          utter.onerror = (ev) => {
            const err = (ev as SpeechSynthesisErrorEvent).error;
            // cancel() for TTS cut-over is not a real failure
            if (err === "interrupted" || err === "canceled") finish(true);
            else finish(false);
          };
          // Chrome bug: speechSynthesis goes mute unless periodically poked
          const keepAlive = window.setInterval(() => {
            try {
              if (window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
              }
            } catch {
              /* noop */
            }
          }, 8000);
          window.speechSynthesis.speak(utter);
          // Safari / some browsers never fire onend
          window.setTimeout(
            () => finish(true),
            Math.min(22000, 900 + text.length * 90)
          );
        } catch {
          resolve(false);
        }
      }, 60);
    } catch {
      resolve(false);
    }
  });
}

export function speakHindiFallback(
  text: string,
  gender: "male" | "female" | string | null | undefined,
  onEnd?: () => void
): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  void speakHindiAsync(text, gender).then(() => onEnd?.());
  return true;
}

export function stopHindiSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* noop */
  }
}
