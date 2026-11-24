import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description:
    "TaraWorld helps people in India make new friends through warm chat and voice — soft, respectful, 18+.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            About
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
            A softer place to make new friends
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            TaraWorld is for evenings when you want company — someone to talk to,
            laugh with, and share little pieces of your day. We design for
            friendship first, with gentle chemistry that stays respectful and
            PG-13.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Built for India. Age-gated. Moderated. Transparent pricing. No
            pressure to meet offline. Your real-world relationships still come
            first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login?next=/app">Try 3 minutes free</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/safety">Our safety promise</Link>
            </Button>
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-white/10">
          <Image
            src="/marketing/mood-chat.jpg"
            alt="Someone enjoying a warm conversation"
            fill
            className="object-cover"
            sizes="(max-width:1024px) 100vw, 40vw"
            priority
          />
        </div>
      </div>
    </div>
  );
}
