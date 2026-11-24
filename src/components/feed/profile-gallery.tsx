"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { resolveCharacterGallery } from "@/lib/character-cover";
import type { Character } from "@/types/database";

type Props = {
  character: Character;
  priority?: boolean;
};

export function ProfileGallery({ character, priority }: Props) {
  const initial = resolveCharacterGallery({
    coverUrl: character.cover_url,
    referenceUrls: character.reference_image_urls,
    gender: character.gender,
    slug: character.slug,
    id: character.id,
  });
  const [images, setImages] = useState(initial);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setImages(initial);
    setIndex(0);
  }, [character.id, character.cover_url]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (images.length <= 1) return;
      setIndex((i) => (i + dir + images.length) % images.length);
    },
    [images.length]
  );

  const onTapSide = (clientX: number, width: number) => {
    if (images.length <= 1) return;
    if (clientX < width * 0.35) go(-1);
    else if (clientX > width * 0.65) go(1);
  };

  const src = images[Math.min(index, images.length - 1)] || character.cover_url;
  const remote = src.startsWith("http");

  return (
    <div
      className="relative aspect-[3/4] w-full select-none"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onTapSide(e.clientX - rect.left, rect.width);
      }}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 40) return;
        go(dx < 0 ? 1 : -1);
      }}
    >
      <Image
        src={src}
        alt={`${character.name} photo ${index + 1}`}
        fill
        unoptimized={remote}
        className="object-cover"
        sizes="(max-width:512px) 100vw, 512px"
        priority={priority}
        onError={() => {
          setImages((prev) => {
            const next = prev.filter((u) => u !== src);
            // Prefer keeping at least the primary cover if everything else 404s
            if (next.length) return next;
            const cover = character.cover_url;
            return cover && cover !== src ? [cover] : prev;
          });
          setIndex(0);
        }}
      />

      {images.length > 1 && (
        <div className="absolute inset-x-3 top-2 z-10 flex gap-1">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Photo ${i + 1}`}
              className={`h-0.5 flex-1 rounded-full transition ${
                i === index ? "bg-white" : "bg-white/35"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
