"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, MessageCircle, Phone, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProfileGallery } from "@/components/feed/profile-gallery";
import { useAccess } from "@/hooks/use-access";
import type { Character } from "@/types/database";
import { toast } from "sonner";

function CharacterSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="relative aspect-[3/4] animate-pulse bg-gradient-to-br from-white/10 via-violet-500/10 to-rose-500/10" />
      <div className="space-y-2 p-4">
        <div className="h-5 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}

export default function AppHomePage() {
  const router = useRouter();
  const { data: access } = useAccess();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [startingSlug, setStartingSlug] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const seenIds = useRef(new Set<string>());
  const seenNames = useRef(new Set<string>());

  const loadPage = useCallback(async (from: number, replace = false) => {
    if (loadingRef.current) return;
    if (!replace && !hasMoreRef.current) return;
    loadingRef.current = true;
    if (from === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const pageSize = 4;
      const exclude = replace
        ? ""
        : [...seenIds.current].join(",");
      const qs = new URLSearchParams({
        offset: String(from),
        limit: String(pageSize),
        generate: "1",
      });
      if (exclude) qs.set("exclude", exclude);
      const res = await fetch(`/api/characters/feed?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not load profiles");
      }
      const batch = (body.characters ?? []) as Character[];
      if (replace) {
        seenIds.current.clear();
        seenNames.current.clear();
      }
      const fresh = batch.filter((c) => {
        const nameKey = c.name.trim().toLowerCase();
        if (seenIds.current.has(c.id) || seenNames.current.has(nameKey)) {
          return false;
        }
        seenIds.current.add(c.id);
        seenNames.current.add(nameKey);
        return true;
      });

      setCharacters((prev) => (replace ? fresh : [...prev, ...fresh]));

      const nextOff = Number(body.nextOffset ?? from + batch.length);
      // If API returned nothing new, bump offset so we don't hammer the same page
      offsetRef.current = fresh.length === 0 ? from + pageSize : nextOff;
      setOffset(offsetRef.current);

      const more = fresh.length > 0 && body.hasMore !== false;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not load profiles");
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    seenIds.current.clear();
    seenNames.current.clear();
    offsetRef.current = 0;
    hasMoreRef.current = true;
    void loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loadingRef.current || !hasMoreRef.current) return;
        void loadPage(offsetRef.current);
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadPage, characters.length, hasMore]);

  const startChat = useCallback(
    async (slug: string) => {
      if (!slug) {
        toast.error("Profile missing — try another one");
        return;
      }
      setStartingSlug(slug);
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slug }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not start chat");
        const id = body.conversation?.id ?? body.id;
        if (!id) throw new Error("No conversation id");
        router.push(`/app/chat/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start chat");
      } finally {
        setStartingSlug(null);
      }
    },
    [router]
  );

  const trialLeft = access?.trial_seconds_left ?? 0;
  const trialActive = access?.trial_active;
  const hasSub = access?.has_active_subscription;

  return (
    <div className="flex flex-1 flex-col px-4 pb-4 pt-6">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300/80">
          TaraWorld
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Scroll. Discover. Chat.
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Keep scrolling to meet more people. Chat with anyone you like.
        </p>
      </header>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
        <Timer className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
        <div className="text-sm leading-snug text-amber-50/95">
          {hasSub ? (
            <p>Your subscription is active. Keep chatting.</p>
          ) : trialActive ? (
            <p>
              Free trial in progress:{" "}
              <span className="font-semibold text-gold">
                {Math.floor(trialLeft / 60)}m{" "}
                {(trialLeft % 60).toString().padStart(2, "0")}s
              </span>{" "}
              left across all chats.
            </p>
          ) : access?.trial_started_at ? (
            <p>
              Your free 3 minutes are over. Subscribe to keep chatting, or use
              your wallet for video calls.
            </p>
          ) : (
            <p>
              Your first message starts{" "}
              <span className="font-semibold text-gold">3 minutes free</span>{" "}
              chat. No subscribe needed until that ends.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {loading && characters.length === 0
          ? Array.from({ length: 2 }).map((_, i) => (
              <CharacterSkeleton key={i} />
            ))
          : characters.map((c, i) => {
              const busy = startingSlug === c.slug;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: Math.min(i * 0.03, 0.2),
                    type: "spring",
                    stiffness: 280,
                    damping: 24,
                  }}
                >
                  <Card className="overflow-hidden border-white/10 bg-white/[0.04] p-0">
                    <div className="relative">
                      <ProfileGallery character={c} priority={i < 2} />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d0714] via-[#0d0714]/40 to-transparent" />
                      <div className="absolute left-3 top-6 z-10">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </span>
                          Online
                        </span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                        <h2 className="font-display text-2xl">{c.name}</h2>
                        <p className="text-sm text-white/70">
                          {c.age} · {c.city}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.tags?.slice(0, 4).map((t) => (
                            <Badge key={t} variant="muted">
                              {t}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button
                            className="flex-1"
                            disabled={busy}
                            onClick={() => startChat(c.slug)}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessageCircle className="h-4 w-4" />
                            )}
                            Chat
                          </Button>
                          <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => router.push(`/app/call/${c.slug}`)}
                          >
                            <Phone className="h-4 w-4" />
                            Video call
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
      </div>

      <div ref={sentinelRef} className="flex h-16 items-center justify-center">
        {loadingMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-rose-300" />
            Loading new profiles…
          </div>
        )}
        {!loading && !loadingMore && !hasMore && characters.length > 0 && (
          <p className="text-xs text-muted-foreground">You’re all caught up</p>
        )}
      </div>
    </div>
  );
}
