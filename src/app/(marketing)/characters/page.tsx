import type { Metadata } from "next";
import Image from "next/image";
import { CharacterGallery } from "@/components/marketing/character-gallery";
import { CHARACTERS } from "@/content/characters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "People",
  description:
    "Browse people on TaraWorld — find a new friend whose vibe matches yours.",
};

export default function CharactersPage() {
  const shuffled = [...CHARACTERS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="relative mb-12 overflow-hidden rounded-[1.75rem] border border-white/10">
        <div className="relative aspect-[21/9] min-h-[180px]">
          <Image
            src="/marketing/friends-sunset.jpg"
            alt="Friends connecting"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0714] via-[#0d0714]/70 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
              People
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-tight text-white sm:text-5xl">
              Who do you want to meet?
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/75 sm:text-base">
              New friends with distinct energy — calm listeners, witty night
              owls, music lovers, fitness buddies. Soft chemistry welcome.
            </p>
          </div>
        </div>
      </div>
      <CharacterGallery characters={shuffled} />
    </div>
  );
}
