"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const BUBBLES = [
  { side: "them" as const, text: "Coffee first, or design critique?" },
  { side: "you" as const, text: "Coffee. Critique can wait ☕" },
  {
    side: "them" as const,
    text: "Deal. Soft lighting, bad jokes, and I’m all ears.",
  },
];

export function HeroMock() {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[min(70vh,560px)] w-full max-w-xl lg:max-w-none lg:h-full lg:min-h-[520px]"
    >
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/hero-banner.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-90"
          sizes="(max-width:1024px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="absolute -right-10 bottom-10 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-4 bottom-8 top-10 flex flex-col justify-end sm:inset-x-8 lg:inset-x-6 lg:bottom-12 lg:top-16"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="relative h-14 w-14 overflow-hidden rounded-2xl shadow-lg shadow-rose-900/40 ring-1 ring-white/20">
            <Image
              src="/characters/aanya/cover.jpg"
              alt=""
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
          <div>
            <p className="font-medium text-foreground">Aanya</p>
            <p className="text-xs text-emerald-300/90">On a call · listening</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="w-1 rounded-full bg-gradient-to-t from-rose-400 to-violet-400"
                animate={{ height: [8, 22, 10, 26, 8] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {BUBBLES.map((b, i) => (
            <motion.div
              key={b.text}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.35 + i * 0.18,
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={
                b.side === "you"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-rose-500/90 to-violet-600/90 px-4 py-3 text-sm text-white shadow-lg shadow-rose-900/25"
                  : "mr-auto max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-white/10 px-4 py-3 text-sm text-foreground/95 backdrop-blur-md"
              }
            >
              {b.text}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
