"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MarketingCharacter } from "@/content/characters";

type Filter = "all" | "female" | "male";

export function CharacterGallery({
  characters,
}: {
  characters: MarketingCharacter[];
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(() => {
    if (filter === "all") return characters;
    return characters.filter((c) => c.gender === filter);
  }, [characters, filter]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "female", label: "Women" },
    { id: "male", label: "Men" },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by gender">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "rounded-2xl border px-4 py-2 text-sm transition",
              filter === tab.id
                ? "border-rose-400/40 bg-gradient-to-r from-rose-500/20 to-violet-600/20 text-foreground"
                : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((c) => (
          <Link
            key={c.slug}
            href={`/characters/${c.slug}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-violet-400/30"
          >
            <div className="relative aspect-[4/5]">
              <Image
                src={c.coverUrl}
                alt={`${c.name} cover`}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                sizes="(max-width:640px) 100vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-display text-xl">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.city} · {c.age}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge key={t} variant="muted">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <p className="line-clamp-2 px-4 py-3 text-sm text-muted-foreground">
              {c.bio}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
