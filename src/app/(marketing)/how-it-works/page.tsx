import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How TaraWorld helps you make new friends — sign up, pick a vibe, chat or call, stay safe.",
};

const SECTIONS = [
  {
    title: "1. Confirm you’re 18+",
    body: "TaraWorld is for adults. We check date of birth and ask you to accept Terms before chatting unlocks.",
  },
  {
    title: "2. Pick someone who matches your mood",
    body: "Browse people by vibe — calm listeners, witty night owls, music lovers, fitness buddies. Read bios and sample lines first.",
  },
  {
    title: "3. Chat free for ~3 minutes",
    body: "Your first conversation includes a free trial window. After that, subscribe to keep chatting with clear, fair limits.",
  },
  {
    title: "4. Call when you want a real voice",
    body: "Voice calls use your wallet (20 paise/min). Top up only when you want to talk live.",
  },
  {
    title: "5. Keep it respectful",
    body: "Light romantic chemistry is fine. Explicit content is not. No pressure to meet offline. Report anything that feels off.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Guide
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
            How new friendships start here
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Simple loop: pick a vibe, talk naturally, pay only for what you use.
            Built for company — not chaos.
          </p>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-white/10">
          <Image
            src="/marketing/friends-cafe.jpg"
            alt="Friends chatting over coffee"
            fill
            className="object-cover"
            sizes="(max-width:1024px) 100vw, 40vw"
            priority
          />
        </div>
      </div>

      <ol className="mt-16 space-y-10">
        {SECTIONS.map((s) => (
          <li key={s.title} className="border-l-2 border-rose-400/40 pl-6">
            <h2 className="font-display text-2xl tracking-tight">{s.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {s.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-14 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/login?next=/app">Meet a new friend</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/characters">Browse people</Link>
        </Button>
      </div>
    </div>
  );
}
