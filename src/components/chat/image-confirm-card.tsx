"use client";

import { motion } from "framer-motion";
import { ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/utils";

export function ImageConfirmCard({
  brief,
  free,
  freeLeft,
  pricePaise,
  loading,
  onConfirm,
  onCancel,
}: {
  brief: string;
  free: boolean;
  freeLeft?: number;
  pricePaise: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="mx-auto w-full max-w-[85%] rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4 backdrop-blur"
    >
      <div className="mb-2 flex items-center gap-2 text-violet-200">
        <ImageIcon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          Image request
        </span>
      </div>
      <p className="text-sm text-foreground/90 line-clamp-3">{brief}</p>
      <p className="mt-3 text-sm">
        {free ? (
          <span className="text-emerald-300">
            Free image
            {typeof freeLeft === "number"
              ? ` ${Math.min(2, Math.max(1, 2 - freeLeft + 1))}/2`
              : ""}
          </span>
        ) : (
          <span>
            This photo costs{" "}
            <span className="text-gold font-semibold">{formatPaise(pricePaise)}</span>
            . Continue?
          </span>
        )}
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={loading}
          onClick={onConfirm}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="flex-1"
          disabled={loading}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
