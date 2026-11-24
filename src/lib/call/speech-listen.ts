/** Browser speech recognition — Hindi. Pause is soft (no abort) so mic keeps working. */

type ListenHandle = {
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

type RecAlt = { transcript?: string; confidence?: number };
type RecResult = {
  isFinal: boolean;
  length: number;
  [index: number]: RecAlt | undefined;
};
type RecEvent = { resultIndex: number; results: ArrayLike<RecResult> };

type RecInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: RecEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecCtor = new () => RecInstance;

function getRecognitionCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function bestTranscript(r: RecResult): { text: string; confidence: number } {
  let bestText = "";
  let bestConf = -1;
  const n = r.length || 1;
  for (let j = 0; j < n; j++) {
    const alt = r[j];
    const t = alt?.transcript?.trim() || "";
    if (!t) continue;
    const c =
      typeof alt?.confidence === "number" && alt.confidence > 0
        ? alt.confidence
        : 0.55;
    if (c > bestConf) {
      bestConf = c;
      bestText = t;
    }
  }
  return { text: bestText, confidence: bestConf < 0 ? 0 : bestConf };
}

function isNoise(text: string, confidence: number): boolean {
  const t = text.trim();
  if (!t) return true;
  if (confidence > 0 && confidence < 0.35 && t.length < 12) return true;
  if (/^(um+|uh+|aa+|ee+|hmm+|अ+|उ+|ah+)$/i.test(t)) return true;
  if (t.length <= 1) return true;
  return false;
}

export function startHindiListening(handlers: {
  onPartial?: (text: string) => void;
  onFinal?: (text: string, meta?: { confidence: number }) => void;
  onError?: (err: string) => void;
}): ListenHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  let stopped = false;
  let paused = false;
  let running = false;
  rec.lang = "hi-IN";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;

  const safeStart = () => {
    if (stopped || paused || running) return;
    try {
      rec.start();
      running = true;
    } catch {
      /* already started */
      running = true;
    }
  };

  rec.onresult = (ev) => {
    if (paused || stopped) return;
    let interim = "";
    let finalText = "";
    let finalConf = 0;
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (!r) continue;
      const { text, confidence } = bestTranscript(r);
      if (!text) continue;
      if (r.isFinal) {
        if (isNoise(text, confidence)) continue;
        finalText += (finalText ? " " : "") + text;
        finalConf = Math.max(finalConf, confidence);
      } else {
        interim += (interim ? " " : "") + text;
      }
    }
    if (interim) handlers.onPartial?.(interim);
    if (finalText) handlers.onFinal?.(finalText, { confidence: finalConf });
  };

  rec.onerror = (ev) => {
    // aborted = our soft pause path should not surface
    if (ev.error === "aborted" || ev.error === "no-speech") return;
    if (ev.error === "network" || ev.error === "not-allowed") {
      handlers.onError?.(ev.error);
    }
    // Chrome often ends the session after error — allow restart
    running = false;
  };

  rec.onend = () => {
    running = false;
    if (!stopped && !paused) {
      // Tiny delay helps Chrome recover the mic
      window.setTimeout(() => safeStart(), 120);
    }
  };

  safeStart();

  return {
    // Soft pause: keep engine alive, just ignore results (abort kills mic on many Chrome builds)
    pause: () => {
      paused = true;
    },
    resume: () => {
      if (stopped) return;
      paused = false;
      safeStart();
    },
    stop: () => {
      stopped = true;
      paused = true;
      try {
        rec.onend = null;
        rec.abort();
      } catch {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
      }
      running = false;
    },
  };
}
