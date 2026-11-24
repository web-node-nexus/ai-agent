"use client";

import { motion } from "framer-motion";
import { Phone, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function TrialEndOffer({
  characterName,
  characterSlug,
  onVideoCall,
  onSubscribe,
  onDismiss,
}: {
  characterName: string;
  characterSlug: string;
  onVideoCall: () => void;
  onSubscribe: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-end-title"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-gradient-to-b from-[#1a0f28] to-[#0d0714] p-6 shadow-2xl sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          aria-label="Maybe later"
        >
          <X className="h-4 w-4" />
        </button>

        <Badge variant="muted" className="mb-3">
          Free trial ended
        </Badge>
        <h2 id="trial-end-title" className="font-display text-2xl text-foreground">
          Want to keep talking with {characterName}?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your free trial has ended. Continue on a video call (wallet), or
          subscribe to keep chatting.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={onVideoCall}
            data-slug={characterSlug}
          >
            <Phone className="h-4 w-4" />
            Start video call
          </Button>
          <Button size="lg" variant="gold" className="w-full" onClick={onSubscribe}>
            <MessageCircle className="h-4 w-4" />
            Keep chatting
          </Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={onDismiss}>
            Maybe later
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
