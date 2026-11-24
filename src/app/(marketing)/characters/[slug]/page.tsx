import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHARACTERS, getCharacter } from "@/content/characters";

export function generateStaticParams() {
  return CHARACTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getCharacter(slug);
  if (!c) return { title: "Character" };
  return {
    title: c.name,
    description: c.bio,
  };
}

export default async function CharacterProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getCharacter(slug);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/characters"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All characters
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_1.1fr] lg:items-start">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10">
          <Image
            src={c.coverUrl}
            alt={c.name}
            fill
            priority
            className="object-cover"
            sizes="(max-width:1024px) 100vw, 40vw"
          />
        </div>

        <div>
          <Badge variant="muted">Online</Badge>
          <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">
            {c.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {c.city} · {c.age} · {c.gender === "female" ? "She/her vibe" : "He/him vibe"}
          </p>
          <p className="mt-6 text-base leading-relaxed text-foreground/90">
            {c.bio}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {c.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sample lines
            </h2>
            <ul className="mt-4 space-y-3">
              {c.sampleLines.map((line) => (
                <li
                  key={line}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm italic text-foreground/90"
                >
                  “{line}”
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login?next=/app">Chat now</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            {c.name} is an AI character on TaraWorld — not a real person, and not
            available for offline meetings. Conversations stay PG-13.
          </p>
        </div>
      </div>
    </div>
  );
}
