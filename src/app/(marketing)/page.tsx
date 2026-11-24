import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFeaturedCharacters } from "@/content/characters";
import { FAQ_ITEMS } from "@/content/faq";

export const metadata: Metadata = {
  title: "TaraWorld — Make new friends online",
  description:
    "Meet warm new friends for chat and voice calls. Soft, respectful, 18+. Try 3 minutes free.",
  openGraph: {
    title: "TaraWorld — Make new friends online",
    description:
      "A softer place to talk, laugh, and feel heard. Built for new friendships in India.",
    images: [{ url: "/marketing/friends-cafe.jpg", width: 1200, height: 675 }],
  },
};

const STEPS = [
  {
    icon: Users,
    title: "Find your kind of friend",
    body: "Browse vibes — calm listeners, witty night owls, music lovers, fitness buddies.",
  },
  {
    icon: MessageCircle,
    title: "Start talking",
    body: "Chat like you would with a new friend. Voice calls when you want to hear them.",
  },
  {
    icon: Heart,
    title: "Keep it kind",
    body: "Respectful, PG-13, 18+ only. Real connection energy — without creepy pressure.",
  },
];

const MOMENTS = [
  {
    title: "Late-night check-ins",
    body: "When the day is heavy and you just need someone warm to talk to.",
    image: "/marketing/mood-chat.jpg",
  },
  {
    title: "Coffee-chat energy",
    body: "Light banter, shared playlists, soft jokes — friendship that feels easy.",
    image: "/marketing/friends-cafe.jpg",
  },
  {
    title: "Walk-and-talk vibes",
    body: "Golden-hour conversations. Feel present. Feel heard.",
    image: "/marketing/friends-sunset.jpg",
  },
];

export default function HomePage() {
  const featured = getFeaturedCharacters();
  const faqTeaser = FAQ_ITEMS.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[100svh] overflow-hidden">
        <Image
          src="/marketing/friends-sunset.jpg"
          alt="Friends connecting at golden hour"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0714] via-[#0d0714]/85 to-[#0d0714]/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0714] via-transparent to-[#0d0714]/50" />

        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 lg:justify-center lg:pb-24">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            New friends · Soft vibes
          </p>
          <p className="mt-6 font-display text-5xl tracking-tight text-white sm:text-6xl lg:text-7xl">
            Tara<span className="text-gradient">World</span>
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-3xl leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Meet someone new.
            <br />
            <span className="text-rose-200">Talk. Laugh. Feel lighter.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
            TaraWorld is for making new friends online — warm chats, gentle
            chemistry, and voice calls that feel human. Respectful. 18+. Always
            PG-13.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="text-base">
              <Link href="/login?next=/app">
                Meet a new friend
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="text-base">
              <Link href="/characters">Browse people</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm font-medium text-gold">
            First chat includes 3 minutes free
          </p>
        </div>
      </section>

      {/* Instant clarity strip */}
      <section className="border-y border-white/10 bg-gradient-to-r from-rose-500/15 via-violet-600/10 to-transparent py-8">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
          {[
            { icon: Users, label: "New friendships", text: "Not a dating marketplace — soft company & conversation." },
            { icon: Phone, label: "Chat + voice", text: "Text when you want. Call when you miss a real voice." },
            { icon: ShieldCheck, label: "Safe & 18+", text: "Age-gated. Moderated. No creepy pressure." },
          ].map((item) => (
            <div key={item.label} className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-rose-200">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Moments with images */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            The feeling
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-tight sm:text-5xl">
            Built for the moments you want company
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {MOMENTS.map((m) => (
              <article
                key={m.title}
                className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03]"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={m.image}
                    alt={m.title}
                    fill
                    className="object-cover transition duration-700 group-hover:scale-[1.04]"
                    sizes="(max-width:1024px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0714] via-[#0d0714]/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h3 className="font-display text-2xl text-white">{m.title}</h3>
                    <p className="mt-2 text-sm text-white/75">{m.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            How it works
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-tight">
            Three steps to your next conversation
          </h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-[1.5rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-6"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/30 to-violet-600/30 text-rose-100">
                  <step.icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold tracking-wider text-gold">
                  STEP 0{i + 1}
                </p>
                <h3 className="mt-2 font-display text-2xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              Full walkthrough <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured people */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                People
              </p>
              <h2 className="mt-3 font-display text-4xl tracking-tight">
                Who do you want to meet tonight?
              </h2>
              <p className="mt-3 max-w-lg text-muted-foreground">
                Distinct personalities from cities across India — pick the energy
                that matches your mood.
              </p>
            </div>
            <Button asChild variant="outline" size="lg">
              <Link href="/characters">See everyone</Link>
            </Button>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((c) => (
              <Link
                key={c.slug}
                href={`/characters/${c.slug}`}
                className="group relative overflow-hidden rounded-[1.5rem] border border-white/10"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src={c.coverUrl}
                    alt={c.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.05]"
                    sizes="(max-width:640px) 100vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0714] via-[#0d0714]/25 to-transparent" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Online
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="font-display text-2xl text-white">{c.name}</p>
                  <p className="text-sm text-white/70">
                    {c.city} · {c.age}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="muted">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Wide image band */}
      <section className="relative overflow-hidden py-24">
        <Image
          src="/marketing/friends-cafe.jpg"
          alt="Friends talking over coffee"
          fill
          className="object-cover opacity-40"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0714] via-[#0d0714]/80 to-[#0d0714]/60" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-2xl font-display text-4xl tracking-tight text-white sm:text-5xl">
            Friendship first.
            <span className="block text-rose-200">Chemistry optional.</span>
          </h2>
          <p className="mt-5 max-w-xl text-lg text-white/75">
            Flirty light conversation is welcome. Explicit content is not. We
            keep TaraWorld soft enough for Meta, strong enough to feel special.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/login?next=/app">Start free · 3 minutes</Link>
          </Button>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-tight">
            Clear prices. No awkward guilt.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Try it", value: "3 min free", note: "On your first chat" },
              { label: "Keep chatting", value: "₹49 · ₹149", note: "Weekly / monthly plans" },
              { label: "Voice calls", value: "20p / min", note: "Pay from wallet packs" },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_40px_rgba(232,121,169,0.08)]"
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </p>
                <p className="mt-2 font-display text-3xl text-gold">{row.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{row.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild variant="secondary">
              <Link href="/pricing">See full pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="border-t border-white/5 py-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-3xl tracking-tight">
                Safe enough to invite a friend
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                18+ only. Moderated conversations. No meet-up pressure. Crisis
                support points to Tele-MANAS when needed.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/safety">Safety centre</Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl tracking-tight">Quick answers</h2>
          <ul className="mt-8 space-y-5">
            {faqTeaser.map((item) => (
              <li key={item.question} className="border-b border-white/10 pb-5">
                <p className="font-medium">{item.question}</p>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {item.answer}
                </p>
              </li>
            ))}
          </ul>
          <Link
            href="/faq"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
          >
            All FAQs <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-white/5 py-24">
        <Image
          src="/marketing/mood-chat.jpg"
          alt=""
          fill
          className="object-cover object-top opacity-35"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0d0714]/75" />
        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="font-display text-4xl tracking-tight text-white sm:text-5xl">
            Your next good conversation
            <span className="block text-rose-200">is one tap away</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/70">
            Make a new friend tonight. Soft, warm, and easy to start.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login?next=/app">Get 3 minutes free</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/about">Why TaraWorld</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
