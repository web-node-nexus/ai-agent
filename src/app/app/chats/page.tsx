"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { resolveCharacterCover } from "@/lib/character-cover";
import type { Conversation } from "@/types/database";

type ConversationRow = Conversation & {
  character?: {
    name: string;
    slug: string;
    cover_url: string;
    gender?: string;
    id?: string;
  } | null;
  characters?: {
    name: string;
    slug: string;
    cover_url: string;
    gender?: string;
    id?: string;
  } | null;
  last_preview?: string;
};

export default function ChatsPage() {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversations", { credentials: "include" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Failed");
        const list = (body.conversations ?? body ?? []) as ConversationRow[];
        if (!cancelled) setRows(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col px-4 pb-4 pt-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Chats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <div className="h-14 w-14 rounded-2xl bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-white/10" />
                <div className="h-3 w-2/3 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
          <MessageCircle className="h-10 w-10 text-violet-300/50" />
          <p className="text-sm text-muted-foreground">
            No chats yet. Head home and say hi.
          </p>
          <Link
            href="/app"
            className="text-sm font-medium text-rose-300 hover:text-rose-200"
          >
            Browse companions
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((c, i) => {
            const char = c.character ?? c.characters;
            const name = char?.name ?? "Companion";
            const slug = char?.slug ?? "";
            const cover = resolveCharacterCover({
              coverUrl: char?.cover_url,
              gender: char?.gender,
              slug,
              id: char?.id,
            });
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/app/chat/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-violet-400/30 hover:bg-white/[0.07]"
                >
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl">
                    <Image src={cover} alt="" fill className="object-cover" sizes="56px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_preview ?? "Tap to continue"}
                    </p>
                  </div>
                  <time className="shrink-0 text-[10px] text-muted-foreground">
                    {c.last_message_at
                      ? new Date(c.last_message_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : ""}
                  </time>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
