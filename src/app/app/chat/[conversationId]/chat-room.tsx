"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageConfirmCard } from "@/components/chat/image-confirm-card";
import {
  MessageBubble,
  TypingIndicator,
} from "@/components/chat/message-bubble";
import { PaywallSheet } from "@/components/chat/paywall-sheet";
import { TrialEndOffer } from "@/components/chat/trial-offer";
import { TrialPill } from "@/components/chat/trial-pill";
import {
  useAccess,
  useInvalidateAccess,
  useSetAccess,
} from "@/hooks/use-access";
import { resolveCharacterCover } from "@/lib/character-cover";
import { createClient } from "@/lib/supabase/client";
import type { AccessState, Character, Message } from "@/types/database";
import { toast } from "sonner";

type ImageRequest = {
  brief: string;
  free: boolean;
  freeLeft?: number;
  pricePaise: number;
};

export function ChatRoom({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { data: access } = useAccess({ refetchInterval: 20_000 });
  const setAccess = useSetAccess();
  const invalidateAccess = useInvalidateAccess();

  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [imageReq, setImageReq] = useState<ImageRequest | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showTrialOffer, setShowTrialOffer] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const trialSeconds = access?.trial_seconds_left ?? 0;
  const trialActive = Boolean(access?.trial_active);

  useEffect(() => {
    if (access && access.trial_active && access.trial_seconds_left <= 0) {
      setShowTrialOffer(true);
    }
  }, [access]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .select("*, characters(*)")
          .eq("id", conversationId)
          .maybeSingle();
        if (convErr) throw convErr;
        if (!conv) {
          toast.error("Chat not found");
          router.replace("/app/chats");
          return;
        }
        const char = (conv.characters ?? conv.character) as Character | null;
        if (!cancelled) setCharacter(char);

        const { data: msgs, error: msgErr } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(200);
        if (msgErr) throw msgErr;
        if (!cancelled) setMessages((msgs as Message[]) ?? []);
      } catch (e) {
        console.error(e);
        toast.error("Could not load chat");
      } finally {
        if (!cancelled) {
          setLoading(false);
          requestAnimationFrame(() => scrollToBottom(false));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, router, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, typing, imageReq, scrollToBottom]);

  const cover = useMemo(() => {
    if (!character) return null;
    return resolveCharacterCover({
      coverUrl: character.cover_url,
      gender: character.gender,
      slug: character.slug,
      id: character.id,
    });
  }, [character]);

  const handlePaywall = useCallback(
    (body: { access?: AccessState; offer?: string }) => {
      if (body.access) setAccess(body.access);
      const trialEnded =
        body.offer === "trial_end" ||
        (Boolean(body.access?.trial_started_at) &&
          !body.access?.trial_active &&
          !body.access?.has_active_subscription);
      if (trialEnded) {
        setShowTrialOffer(true);
      } else {
        setPaywallOpen(true);
      }
      invalidateAccess();
    },
    [invalidateAccess, setAccess]
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    // First message starts the free trial — don't block before the clock starts
    const trialNotStarted = access && !access.trial_started_at;
    const trialStillOk =
      access?.trial_active ||
      access?.trial_eligible ||
      access?.has_active_subscription ||
      trialNotStarted;

    if (access && !access.can_chat && !trialStillOk) {
      if (access.trial_started_at && !access.trial_active) {
        setShowTrialOffer(true);
      } else {
        setPaywallOpen(true);
      }
      return;
    }
    if (
      access?.trial_started_at &&
      !access.trial_active &&
      !access.has_active_subscription
    ) {
      setShowTrialOffer(true);
      return;
    }

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      conversation_id: conversationId,
      user_id: "me",
      role: "user",
      content: text,
      kind: "text",
      image_id: null,
      source: "chat",
      meta: {},
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput("");
    setSending(true);
    setTyping(true);
    setStreamingText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        credentials: "include",
        body: JSON.stringify({ conversationId, message: text }),
      });

      if (res.status === 402) {
        const body = await res.json().catch(() => ({}));
        handlePaywall(body);
        setTyping(false);
        setSending(false);
        return;
      }

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Chat failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const raw = line.replace(/^data:\s*/, "").trim();
          if (!raw || raw === "[DONE]") continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          const type = (event.type as string) ?? (event.event as string);

          if (type === "token" || type === "delta") {
            const t = (event.text as string) ?? (event.delta as string) ?? "";
            assembled += t;
            setStreamingText(assembled);
          } else if (type === "image_request") {
            setImageReq({
              brief: (event.brief as string) ?? "",
              free: Boolean(event.free),
              freeLeft:
                typeof event.freeLeft === "number"
                  ? event.freeLeft
                  : typeof event.free_images_left === "number"
                    ? event.free_images_left
                    : undefined,
              pricePaise:
                typeof event.pricePaise === "number"
                  ? event.pricePaise
                  : typeof event.price_paise === "number"
                    ? event.price_paise
                    : (access?.image_price_paise ?? 300),
            });
          } else if (type === "done") {
            if (event.access) setAccess(event.access as AccessState);
            const content =
              (event.content as string) ??
              assembled ??
              (event.message as { content?: string })?.content ??
              "";
            if (content) {
              const assistant: Message = {
                id:
                  (event.messageId as string) ??
                  (event.message as { id?: string })?.id ??
                  `asst-${Date.now()}`,
                conversation_id: conversationId,
                user_id: "assistant",
                role: "assistant",
                content,
                kind: "text",
                image_id: null,
                source: "chat",
                meta: {},
                created_at: new Date().toISOString(),
              };
              setMessages((m) => [...m, assistant]);
            }
            setStreamingText("");
            if (
              event.access &&
              (event.access as AccessState).trial_seconds_left === 0 &&
              (event.access as AccessState).trial_active === false
            ) {
              setShowTrialOffer(true);
            }
          } else if (type === "error") {
            throw new Error((event.error as string) ?? "Stream error");
          } else if (type === "access" && event.access) {
            setAccess(event.access as AccessState);
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Message fail");
    } finally {
      setTyping(false);
      setSending(false);
      setStreamingText("");
      invalidateAccess();
    }
  }, [
    access,
    conversationId,
    handlePaywall,
    input,
    invalidateAccess,
    sending,
    setAccess,
  ]);

  const confirmImage = useCallback(
    async (confirmed: boolean) => {
      if (!imageReq) return;
      if (!confirmed) {
        setImageReq(null);
        return;
      }
      setImageLoading(true);
      try {
        const res = await fetch("/api/images/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            conversationId,
            brief: imageReq.brief,
            confirmed: true,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 402) {
          handlePaywall(body);
          return;
        }
        if (!res.ok) {
          throw new Error(body.error ?? "Image failed");
        }
        if (body.needsConfirmation) {
          setImageReq((prev) =>
            prev
              ? {
                  ...prev,
                  free: false,
                  pricePaise: body.pricePaise ?? prev.pricePaise,
                }
              : prev
          );
          return;
        }
        const url = body.url ?? body.signedUrl ?? body.message?.meta?.url;
        const imgMsg: Message = {
          id: body.message?.id ?? `img-${Date.now()}`,
          conversation_id: conversationId,
          user_id: "assistant",
          role: "assistant",
          content: body.message?.content ?? imageReq.brief,
          kind: "image",
          image_id: body.imageId ?? body.message?.image_id ?? null,
          source: "chat",
          meta: { url, signedUrl: url },
          created_at: new Date().toISOString(),
        };
        setMessages((m) => [...m, imgMsg]);
        setImageReq(null);
        if (body.access) setAccess(body.access);
        invalidateAccess();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Image fail");
      } finally {
        setImageLoading(false);
      }
    },
    [conversationId, handlePaywall, imageReq, invalidateAccess, setAccess]
  );

  const reportMessage = useCallback(async (messageId: string) => {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messageId,
          conversationId,
          reason: "user_report",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Report failed");
      }
      toast.success("Reported — thanks for keeping TaraWorld safe");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Report failed");
    }
  }, [conversationId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-mesh">
      <header className="flex items-center gap-3 border-b border-white/10 bg-[color:var(--glass)] px-3 py-2.5 backdrop-blur-xl pt-[max(0.625rem,env(safe-area-inset-top))]">
        <Link
          href="/app/chats"
          className="rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {cover && (
          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/15">
            <Image src={cover} alt="" fill className="object-cover" sizes="40px" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-medium">
            {character?.name ?? "Companion"}
          </h1>
          <p className="text-[10px] text-muted-foreground">Online</p>
        </div>
        <TrialPill secondsLeft={trialSeconds} trialActive={trialActive} />
        {character?.slug && (
          <Button
            size="icon"
            variant="secondary"
            aria-label="Video call"
            onClick={() => router.push(`/app/call/${character.slug}`)}
          >
            <Phone className="h-4 w-4" />
          </Button>
        )}
      </header>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-12 animate-pulse rounded-2xl bg-white/8 ${
                  i % 2 === 0 ? "mr-auto w-2/3" : "ml-auto w-1/2"
                }`}
              />
            ))}
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onReport={reportMessage} />
            ))}
            {streamingText && (
              <MessageBubble
                message={{
                  id: "streaming",
                  conversation_id: conversationId,
                  user_id: "assistant",
                  role: "assistant",
                  content: streamingText,
                  kind: "text",
                  image_id: null,
                  source: "chat",
                  meta: {},
                  created_at: new Date().toISOString(),
                }}
              />
            )}
            {typing && !streamingText && <TypingIndicator />}
            {imageReq && (
              <div className="my-3">
                <ImageConfirmCard
                  brief={imageReq.brief}
                  free={imageReq.free}
                  freeLeft={imageReq.freeLeft}
                  pricePaise={imageReq.pricePaise}
                  loading={imageLoading}
                  onConfirm={() => confirmImage(true)}
                  onCancel={() => confirmImage(false)}
                />
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-white/10 bg-[color:var(--glass)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          disabled={sending}
          className="flex-1"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !input.trim()}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      <AnimatePresence>
        {showTrialOffer && character && (
          <TrialEndOffer
            characterName={character.name}
            characterSlug={character.slug}
            onVideoCall={() => {
              setShowTrialOffer(false);
              router.push(`/app/call/${character.slug}`);
            }}
            onSubscribe={() => {
              setShowTrialOffer(false);
              router.push("/app/subscription");
            }}
            onDismiss={() => setShowTrialOffer(false)}
          />
        )}
      </AnimatePresence>

      <PaywallSheet
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        access={access}
      />
    </div>
  );
}
