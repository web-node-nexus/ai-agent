"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  connectGeminiLive,
  createPlaybackQueue,
  startMicCapture,
  type PlaybackQueue,
} from "@/lib/call/gemini-live";
import { stopHindiSpeech } from "@/lib/call/hindi-voice";
import { audioBase64ToBlob, playWavBlob } from "@/lib/call/play-wav";
import { resolveCharacterGallery } from "@/lib/character-cover";
import { ringDurationMs, startRingtone } from "@/lib/call/ringtone";
import { startHindiListening } from "@/lib/call/speech-listen";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, formatPaise } from "@/lib/utils";
import { useInvalidateAccess } from "@/hooks/use-access";
import type { Character } from "@/types/database";
import { toast } from "sonner";

type CallState =
  | "ringing"
  | "connecting"
  | "listening"
  | "speaking"
  | "ended";

export function CallRoom({ characterSlug }: { characterSlug: string }) {
  const router = useRouter();
  const invalidateAccess = useInvalidateAccess();

  const [character, setCharacter] = useState<Character | null>(null);
  const [state, setState] = useState<CallState>("ringing");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [balanceLeft, setBalanceLeft] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [summary, setSummary] = useState<{
    duration: number;
    chargePaise: number;
  } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [warnLow, setWarnLow] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const micStopRef = useRef<(() => void) | null>(null);
  const playbackRef = useRef<PlaybackQueue | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const wsCloseRef = useRef<(() => void) | null>(null);
  const mutedRef = useRef(false);
  const endedRef = useRef(false);
  const liveRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedAtRef = useRef<number>(Date.now());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopHindiSpeech();
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("characters")
          .select("*")
          .eq("slug", characterSlug)
          .eq("is_active", true)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          // Fallback so call UI still starts even if RLS/read fails
          const res = await fetch(
            `/api/characters/feed?offset=0&limit=12&generate=0`,
            { credentials: "include" }
          );
          const body = await res.json().catch(() => ({}));
          const found = (body.characters as Character[] | undefined)?.find(
            (c) => c.slug === characterSlug
          );
          if (found) setCharacter(found);
          else toast.error("Profile load nahi hua — refresh karo");
          return;
        }
        setCharacter(data as Character);
      } catch {
        if (!cancelled) toast.error("Profile load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [characterSlug]);

  const endCall = useCallback(
    async (reason: string = "user_ended") => {
      if (endedRef.current) return;
      endedRef.current = true;
      liveRef.current = false;
      setEndReason(reason);
      setState("ended");

      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* noop */
      }

      micStopRef.current?.();
      micStopRef.current = null;
      playbackRef.current?.dispose();
      playbackRef.current = null;
      wsCloseRef.current?.();
      wsCloseRef.current = null;
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      void playCtxRef.current?.close();
      playCtxRef.current = null;

      const sessionId = sessionIdRef.current;
      if (sessionId) {
        try {
          const res = await fetch("/api/call/end", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ sessionId, reason }),
          });
          const body = await res.json().catch(() => ({}));
          setSummary({
            duration:
              body.durationSeconds ??
              body.seconds_billed ??
              body.duration ??
              Math.floor((Date.now() - startedAtRef.current) / 1000),
            chargePaise:
              body.chargePaise ??
              body.paise_charged ??
              body.charged_paise ??
              0,
          });
        } catch {
          setSummary({
            duration: Math.floor((Date.now() - startedAtRef.current) / 1000),
            chargePaise: 0,
          });
        }
      } else {
        setSummary({
          duration: Math.max(
            0,
            Math.floor((Date.now() - startedAtRef.current) / 1000)
          ),
          chargePaise: 0,
        });
      }
      invalidateAccess();
    },
    [invalidateAccess, localStream]
  );

  // Ring → start → connect (or demo fallback)
  useEffect(() => {
    if (!character) return;
    // Already live for this character — don't restart (Strict Mode / HMR remount)
    if (
      liveRef.current &&
      sessionIdRef.current &&
      !endedRef.current
    ) {
      return;
    }

    let cancelled = false;
    let ringtone: ReturnType<typeof startRingtone> | null = null;
    let ringTimer: number | null = null;
    endedRef.current = false;
    liveRef.current = false;
    sessionIdRef.current = null;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        ringTimer = window.setTimeout(() => resolve(), ms);
      });

    let demoActive = false;
    let speakingLock = false;

    const ensurePlayback = async () => {
      if (playCtxRef.current && playbackRef.current) return;
      const playCtx = new AudioContext();
      await playCtx.resume();
      playCtxRef.current = playCtx;
      const queue = createPlaybackQueue(playCtx, (speaking) => {
        if (endedRef.current) return;
        setState(speaking ? "speaking" : "listening");
      });
      playbackRef.current = queue;
      analyserRef.current = queue.getAnalyser();
    };

    let listenHandle: ReturnType<typeof startHindiListening> = null;
    let stopWav: (() => void) | null = null;

    const playAudioBase64 = async (
      b64: string,
      sampleRate = 24000,
      mimeType?: string | null
    ): Promise<boolean> => {
      const blob = audioBase64ToBlob(b64, mimeType, sampleRate);
      if (!blob) return false;
      const played = playWavBlob(blob);
      stopWav = played.stop;
      const ok = await played.done;
      stopWav = null;
      return ok;
    };

    let lastSpokenLine = "";
    let ignoreListenUntil = 0;

    /** Fetch audio first, THEN show text + play — no 5s silent caption. */
    const speakNatural = async (
      line: string,
      readyAudio?: {
        audioBase64: string;
        sampleRate?: number;
        mimeType?: string | null;
      } | null
    ) => {
      if (endedRef.current || cancelled) return;
      stopHindiSpeech();
      stopWav?.();
      stopWav = null;
      playbackRef.current?.interrupt();
      speakingLock = true;
      listenHandle?.pause();
      lastSpokenLine = line.trim();
      // Don't show reply text until audio is ready (fixes text-then-delay)
      setState("speaking");

      try {
        try {
          await ensurePlayback();
          await playCtxRef.current?.resume();
        } catch {
          /* continue */
        }

        const fetchAudio = async (ms: number) => {
          const speakRes = await Promise.race([
            fetch("/api/call/speak", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                text: line,
                characterSlug,
                characterId: character.id,
              }),
            }),
            new Promise<null>((r) => window.setTimeout(() => r(null), ms)),
          ]);
          if (!speakRes || !("ok" in speakRes)) return null;
          const body = await speakRes.json().catch(() => ({}));
          if (!body.audioBase64) return null;
          return body as {
            audioBase64: string;
            sampleRate?: number;
            mimeType?: string | null;
          };
        };

        let audio =
          readyAudio?.audioBase64
            ? readyAudio
            : await fetchAudio(14000);
        if (!audio?.audioBase64) audio = (await fetchAudio(10000)) || null;

        if (!audio?.audioBase64) {
          return;
        }

        // Caption only when we actually start speaking
        await playAudioBase64(
          audio.audioBase64,
          audio.sampleRate ?? 24000,
          audio.mimeType
        );
      } finally {
        // Brief mute only — long ignore was eating the user's next "hello"
        ignoreListenUntil = Date.now() + 500;
        speakingLock = false;
        window.setTimeout(() => {
          if (endedRef.current || cancelled) return;
          listenHandle?.resume();
          setState("listening");
          // Flush anything said while AI was talking
          flushQueued?.();
        }, 350);
      }
    };

    let flushQueued: (() => void) | null = null;

    const enterDemo = (
      line: string,
      sid?: string,
      readyAudio?: {
        audioBase64: string;
        sampleRate?: number;
        mimeType?: string | null;
      } | null
    ) => {
      const sessionId = sid || sessionIdRef.current;
      if (endedRef.current || cancelled || demoActive || !sessionId) return;
      demoActive = true;
      liveRef.current = true;
      setState("listening");

      let turnBusy = false;
      let queuedAfterBusy: string | null = null;
      let pending = "";
      let silenceTimer: number | null = null;

      const isEchoOfAi = (text: string) => {
        // Only within short post-speech window — never forever-block "hello"
        if (Date.now() >= ignoreListenUntil) return false;
        if (!lastSpokenLine) return false;
        const norm = (s: string) =>
          s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
        const a = norm(text);
        const b = norm(lastSpokenLine);
        if (!a || !b) return false;
        // Exact / near-exact only (old logic blocked user "हेलो" after AI "हेलो?")
        if (a === b) return true;
        if (a.length >= 8 && b.includes(a)) return true;
        if (b.length >= 8 && a.includes(b)) return true;
        return false;
      };

      const replyToUser = async (heard: string, attempt = 0) => {
        const text = heard.trim();
        if (!text || text.length < 1 || endedRef.current || cancelled) {
          return;
        }
        if (turnBusy || speakingLock) {
          queuedAfterBusy = text;
          return;
        }
        if (isEchoOfAi(text)) {
          return;
        }

        turnBusy = true;
        pending = "";
        speakingLock = true;
        listenHandle?.pause();
        ignoreListenUntil = Date.now() + 2500;

        const controller = new AbortController();
        const kill = window.setTimeout(() => controller.abort(), 20000);

        try {
          const turnRes = await fetch("/api/call/turn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({
              sessionId,
              characterSlug,
              userText: text,
            }),
          });
          window.clearTimeout(kill);
          const turnBody = await turnRes.json().catch(() => ({}));
          if (!turnRes.ok || !turnBody.text) {
            speakingLock = false;
            ignoreListenUntil = Date.now() + 300;
            listenHandle?.resume();
            if (attempt < 1) {
              turnBusy = false;
              await replyToUser(text, attempt + 1);
              return;
            }
            toast.message("Thoda network issue — phir se soft bolo");
            return;
          }
          const replyText = String(turnBody.text).trim();
          await speakNatural(
            replyText,
            turnBody.audioBase64
              ? {
                  audioBase64: turnBody.audioBase64,
                  sampleRate: turnBody.sampleRate,
                  mimeType: turnBody.mimeType,
                }
              : null
          );
        } catch {
          window.clearTimeout(kill);
          speakingLock = false;
          ignoreListenUntil = Date.now() + 300;
          listenHandle?.resume();
          if (attempt < 1) {
            turnBusy = false;
            await replyToUser(text, attempt + 1);
            return;
          }
          toast.message("Network issue — phir se try");
        } finally {
          turnBusy = false;
          const next = queuedAfterBusy;
          queuedAfterBusy = null;
          if (next && !endedRef.current && !isEchoOfAi(next)) {
            window.setTimeout(() => void replyToUser(next), 80);
          }
        }
      };

      flushQueued = () => {
        const next = queuedAfterBusy;
        queuedAfterBusy = null;
        if (next && !endedRef.current) void replyToUser(next);
      };

      const scheduleReply = (chunk: string) => {
        pending = `${pending} ${chunk}`.trim();
        if (silenceTimer) window.clearTimeout(silenceTimer);
        silenceTimer = window.setTimeout(() => {
          const toSend = pending.trim();
          pending = "";
          if (toSend.length >= 1) void replyToUser(toSend);
        }, 400);
      };

      listenHandle = startHindiListening({
        onPartial: () => {},
        onFinal: (t) => {
          if (speakingLock) {
            queuedAfterBusy = t;
            return;
          }
          if (Date.now() < ignoreListenUntil && isEchoOfAi(t)) return;
          scheduleReply(t);
        },
        onError: (err) => {
          if (err === "not-allowed") {
            toast.error("Chrome mic permission on karo");
          }
        },
      });

      if (!listenHandle) {
        toast.error("Chrome pe mic / speech allow karo — call voice ke liye zaroori hai");
      }

      // Soft-pause while greeting plays, then open mic — no second getUserMedia (breaks STT)
      listenHandle?.pause();
      micStopRef.current = () => {
        if (silenceTimer) window.clearTimeout(silenceTimer);
        listenHandle?.stop();
      };

      void (async () => {
        await speakNatural(line, readyAudio);
        // speakNatural finally already resumes; ensure listen is live
        listenHandle?.resume();
        setState("listening");
      })();
    };

    (async () => {
      try {
        setState("ringing");
        try {
          ringtone = startRingtone();
        } catch {
          /* autoplay blocked */
        }

        // Start session while ringing — don't wait for ring then wait again
        const startPromise = fetch("/api/call/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ characterSlug }),
        }).then(async (res) => {
          const body = await res.json().catch(() => ({}));
          return { res, body };
        });

        await wait(ringDurationMs());
        if (cancelled || endedRef.current) return;

        ringtone?.stop();
        ringtone = null;
        setState("connecting");

        const { res, body } = await startPromise;
        if (cancelled || endedRef.current) return;

        if (!res.ok) {
          throw new Error(
            body.message || body.error || "Could not start call"
          );
        }

        const sessionId = body.sessionId ?? body.id;
        if (!sessionId) throw new Error("Missing call session");
        sessionIdRef.current = sessionId;
        startedAtRef.current = Date.now();
        liveRef.current = true;

        if (typeof body.wallet_balance === "number") {
          setBalanceLeft(body.wallet_balance);
        }
        if (typeof body.maxSeconds === "number") setSecondsLeft(body.maxSeconds);

        const greeting =
          body.greeting ||
          (character.gender === "male"
            ? `Haan, ${character.name}… kaise ho?`
            : `Haan, ${character.name}… kaise ho?`);

        // Demo / TTS path when Live token unavailable
        if (body.demo || !body.token) {
          enterDemo(
            greeting,
            sessionId,
            body.greetingAudioBase64
              ? {
                  audioBase64: body.greetingAudioBase64,
                  sampleRate: body.greetingSampleRate ?? 24000,
                  mimeType: body.greetingMimeType ?? null,
                }
              : null
          );
          return;
        }

        await ensurePlayback();

        let opened = false;
        let intentionalClose = false;
        const live = connectGeminiLive(body.token, {
          onOpen: () => {
            opened = true;
            if (!cancelled && !endedRef.current) setState("listening");
          },
          onAudio: (pcm, mime) => {
            const rateMatch = /rate=(\d+)/.exec(mime);
            const rate = rateMatch ? Number(rateMatch[1]) : 24000;
            playbackRef.current?.enqueue(pcm, rate);
          },
          onText: (text) => {
          },
          onInterrupted: () => {
            playbackRef.current?.interrupt();
            setState("listening");
          },
          onClose: () => {
            if (intentionalClose || endedRef.current || cancelled || demoActive)
              return;
            // Live socket dropped — keep call alive with browser voice
            enterDemo(
              opened ? `Still here with you. ${greeting}` : greeting
            );
          },
          onError: () => {
            /* close handler covers fallback */
          },
        });
        wsCloseRef.current = () => {
          intentionalClose = true;
          try {
            live.ws.close();
          } catch {
            /* noop */
          }
        };

        // If WS never opens, fall back to demo instead of stuck connecting
        window.setTimeout(() => {
          if (cancelled || endedRef.current || opened || demoActive) return;
          intentionalClose = true;
          try {
            live.ws.close();
          } catch {
            /* noop */
          }
          enterDemo(greeting);
        }, 8_000);

        try {
          const mic = await startMicCapture((pcm) => {
            if (mutedRef.current) return;
            let energy = 0;
            for (let i = 0; i < pcm.length; i++) energy += Math.abs(pcm[i]!);
            const avg = energy / Math.max(1, pcm.length);
            if (avg > 900) {
              playbackRef.current?.interrupt();
            }
            live.sendRealtimePcm(pcm);
          });
          micStopRef.current = mic.stop;
        } catch {
          toast.error("Microphone permission needed");
        }
      } catch (e) {
        ringtone?.stop();
        const msg = e instanceof Error ? e.message : "Call failed";
        toast.error(msg);
        if (!cancelled && mountedRef.current) {
          setEndReason(msg);
          setState("ended");
          endedRef.current = true;
          setSummary({
            duration: Math.max(
              0,
              Math.floor((Date.now() - startedAtRef.current) / 1000)
            ),
            chargePaise: 0,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      ringtone?.stop();
      if (ringTimer) window.clearTimeout(ringTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id, characterSlug]);

  // Elapsed timer (only after call is live)
  useEffect(() => {
    if (state === "ended" || state === "connecting" || state === "ringing")
      return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      setSecondsLeft((s) => (typeof s === "number" ? Math.max(0, s - 1) : s));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state]);

  // Heartbeat every 15s (after connected)
  useEffect(() => {
    if (state === "ended" || state === "connecting" || state === "ringing")
      return;
    const beat = async () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || endedRef.current) return;
      try {
        const res = await fetch("/api/call/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 402 || body.exhausted) {
            await endCall("balance_exhausted");
          }
          return;
        }
        if (typeof body.wallet_balance === "number") {
          setBalanceLeft(body.wallet_balance);
        }
        const left =
          typeof body.remaining_seconds === "number"
            ? body.remaining_seconds
            : typeof body.secondsLeft === "number"
              ? body.secondsLeft
              : null;
        if (typeof left === "number") {
          setSecondsLeft(left);
          if (left <= 60 && left > 0) setWarnLow(true);
        }
        // Only end from heartbeat for real billing/time limits — ignore vague "error"
        if (body.ended) {
          const reason = String(body.end_reason ?? "");
          if (
            reason === "balance_exhausted" ||
            reason === "max_duration" ||
            reason === "admin"
          ) {
            await endCall(reason);
          }
        }
      } catch {
        /* transient */
      }
    };
    void beat();
    const id = window.setInterval(beat, 15_000);
    return () => window.clearInterval(id);
  }, [state, endCall]);

  // Camera preview
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      if (!cameraOn) {
        setLocalStream(null);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      } catch {
        toast.error("Camera unavailable");
        setCameraOn(false);
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn]);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // End session only on real page leave — NOT on React Strict Mode / HMR remount
  // (those were killing the call the instant it "answered")
  useEffect(() => {
    const settle = () => {
      if (!liveRef.current || !sessionIdRef.current || endedRef.current) return;
      const sid = sessionIdRef.current;
      endedRef.current = true;
      micStopRef.current?.();
      wsCloseRef.current?.();
      void fetch("/api/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: sid, reason: "abandoned" }),
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", settle);
    window.addEventListener("beforeunload", settle);
    return () => {
      window.removeEventListener("pagehide", settle);
      window.removeEventListener("beforeunload", settle);
    };
  }, []);

  const gallery = character
    ? resolveCharacterGallery({
        coverUrl: character.cover_url,
        referenceUrls: character.reference_image_urls,
        gender: character.gender,
        slug: character.slug,
        id: character.id,
      })
    : [];
  const cover =
    gallery[0] ||
    character?.cover_url ||
    `/characters/${characterSlug}/cover.jpg`;
  const statusLabel =
    state === "ringing"
      ? "Ringing…"
      : state === "connecting"
        ? "Connecting…"
        : state === "speaking"
          ? "On call"
          : state === "listening"
            ? "On call"
            : "Ended";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-foreground">
      <div className="absolute inset-0 overflow-hidden bg-[#1a1028]">
        {/* Real photoreal cover only — no VRM / SVG / fake mouth overlay */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={character?.name || "Call"}
          className={`h-full w-full object-cover transition duration-500 ${
            state === "speaking" ? "scale-[1.02] brightness-110" : "scale-100"
          }`}
          onError={(e) => {
            const img = e.currentTarget;
            const next = gallery.find((u) => u !== img.src);
            if (next) img.src = next;
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/20 to-ink/95" />
        {state === "speaking" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-rose-500/20 to-transparent" />
        )}
      </div>

      {cameraOn && (
        <div className="absolute right-4 top-20 z-20 h-36 w-28 overflow-hidden rounded-2xl border border-white/20 shadow-xl">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full scale-x-[-1] object-cover"
          />
        </div>
      )}

      <header className="relative z-10 flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <h1 className="font-display text-xl">{character?.name ?? "…"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            <span
              className={
                state === "speaking"
                  ? "text-rose-300"
                  : state === "listening"
                    ? "text-emerald-300"
                    : "text-muted-foreground"
              }
            >
              {statusLabel}
            </span>
            {" · "}
            {formatDuration(elapsed)}
          </p>
        </div>
        <div className="text-right text-xs">
          {balanceLeft != null && (
            <p className="font-semibold text-gold">{formatPaise(balanceLeft)}</p>
          )}
          {secondsLeft != null && (
            <p className={warnLow ? "text-amber-300" : "text-muted-foreground"}>
              {formatDuration(secondsLeft)} left
            </p>
          )}
        </div>
      </header>

      <AnimatePresence>
        {warnLow && state !== "ended" && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative z-10 mx-4 mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/15 px-3 py-2 text-center text-xs text-amber-100"
          >
            About 1 minute left — top up soon to keep talking.
          </motion.p>
        )}
      </AnimatePresence>

      {state !== "ended" &&
        state !== "ringing" &&
        state !== "connecting" && (
          null
        )}

      {(state === "ringing" || state === "connecting") && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink/55 backdrop-blur-sm">
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-full bg-rose-400/30"
              animate={{ scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl">{character?.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {state === "ringing"
                ? "Calling…"
                : `${character?.name} answered`}
            </p>
          </div>
          {state === "connecting" && (
            <Loader2 className="h-5 w-5 animate-spin text-rose-300" />
          )}
          {state === "ringing" && (
            <Button
              variant="danger"
              className="mt-4 rounded-full px-8"
              onClick={() => void endCall("user_ended")}
            >
              <PhoneOff className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      )}

      {state === "ended" && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-ink/80 backdrop-blur-md sm:items-center">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#140a1e] p-6 sm:rounded-3xl"
          >
            <h2 className="font-display text-2xl">Call ended</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Duration{" "}
              <span className="text-foreground">
                {formatDuration(summary?.duration ?? elapsed)}
              </span>
              {" · "}
              Charged{" "}
              <span className="font-semibold text-gold">
                {formatPaise(summary?.chargePaise ?? 0)}
              </span>
            </p>
            {endReason &&
              endReason !== "user_ended" &&
              endReason !== "abandoned" && (
                <p className="mt-2 text-xs text-amber-200/90">
                  {endReason === "error"
                    ? "Connection dropped. Try Call again."
                    : endReason === "balance_exhausted"
                      ? "Wallet balance ran out."
                      : endReason === "max_duration"
                        ? "Time limit reached."
                        : endReason}
                </p>
              )}
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => {
                  window.location.href = `/app/call/${characterSlug}`;
                }}
                className="w-full"
              >
                Call again
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => router.push("/app/wallet")}
              >
                Add wallet balance
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => router.push("/app")}
              >
                Back home
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {state !== "ended" && state !== "ringing" && (
        <footer className="relative z-10 mt-auto flex items-center justify-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <Button
            variant="secondary"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={() => setCameraOn((c) => !c)}
            aria-label={cameraOn ? "Camera off" : "Camera on"}
          >
            {cameraOn ? (
              <Camera className="h-5 w-5" />
            ) : (
              <CameraOff className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="danger"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={() => void endCall("user_ended")}
            aria-label="End call"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </footer>
      )}
    </div>
  );
}
