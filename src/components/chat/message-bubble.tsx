"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Flag, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/database";
import { toast } from "sonner";

export function MessageBubble({
  message,
  onReport,
}: {
  message: Message;
  onReport?: (messageId: string) => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system" || message.kind === "system";
  const [zoom, setZoom] = useState(false);
  const imageUrl =
    message.kind === "image"
      ? (message.meta?.url as string | undefined) ??
        (message.meta?.signedUrl as string | undefined) ??
        (message.content.startsWith("http") ? message.content : undefined)
      : undefined;

  if (isSystem) {
    return (
      <div className="mx-auto my-2 max-w-[90%] text-center text-[11px] text-muted-foreground">
        {message.content}
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={cn(
          "group relative mb-2 flex max-w-[82%] flex-col gap-1",
          isUser ? "ml-auto items-end" : "mr-auto items-start"
        )}
      >
        {imageUrl ? (
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-white/10 bg-white/5",
              isUser ? "rounded-br-md" : "rounded-bl-md"
            )}
          >
            <button
              type="button"
              className="relative block"
              onClick={() => setZoom(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Photo"
                className="max-h-72 w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
                Photo
              </span>
              <span className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
                <ZoomIn className="h-3.5 w-3.5" />
              </span>
            </button>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <a
                href={imageUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3 w-3" />
                Download
              </a>
              {!isUser && onReport && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-danger"
                  onClick={() => onReport(message.id)}
                >
                  <Flag className="h-3 w-3" />
                  Report
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
              isUser
                ? "rounded-br-md bg-gradient-to-br from-rose-500 to-violet-600 text-white"
                : "rounded-bl-md border border-white/10 bg-white/8 text-foreground backdrop-blur"
            )}
          >
            {message.content}
          </div>
        )}

        {!isUser && !imageUrl && onReport && (
          <button
            type="button"
            className="opacity-0 transition group-hover:opacity-100 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-danger"
            onClick={() => onReport(message.id)}
          >
            <Flag className="h-3 w-3" />
            Report
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {zoom && imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setZoom(false)}
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-4 top-4"
              onClick={() => setZoom(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Photo"
              className="max-h-[90dvh] max-w-full rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <a
              href={imageUrl}
              download
              className="absolute bottom-6"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toast.success("Opening download…")}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function TypingIndicator() {
  return (
    <div className="mb-2 flex max-w-[70px] items-center gap-1 rounded-2xl rounded-bl-md border border-white/10 bg-white/8 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-violet-300"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
