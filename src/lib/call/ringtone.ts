/** Simple phone-style ringtone via Web Audio (no asset required). */

export type RingtoneHandle = {
  stop: () => void;
};

export function startRingtone(): RingtoneHandle {
  const ctx = new AudioContext();
  let stopped = false;
  let timer: number | null = null;

  const playBurst = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    // Dual-tone burst ~1.2s (classic phone-ish)
    for (const freq of [440, 480]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
      gain.gain.setValueAtTime(0.08, now + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    }
    timer = window.setTimeout(playBurst, 2200);
  };

  void ctx.resume().then(playBurst);

  return {
    stop: () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      void ctx.close();
    },
  };
}

/** Short ring so call connects fast (was 5–7s and felt stuck). */
export function ringDurationMs() {
  return 2200 + Math.floor(Math.random() * 800);
}
