"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

export function TrialPill({
  secondsLeft,
  trialActive,
  className,
}: {
  secondsLeft: number;
  trialActive: boolean;
  className?: string;
}) {
  const [left, setLeft] = useState(secondsLeft);

  useEffect(() => {
    setLeft(secondsLeft);
  }, [secondsLeft]);

  useEffect(() => {
    if (!trialActive || left <= 0) return;
    const id = window.setInterval(() => {
      setLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [trialActive, left > 0]);

  if (!trialActive) return null;

  const urgent = left <= 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums",
        urgent
          ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
          : "border-violet-400/30 bg-violet-500/15 text-violet-100",
        className
      )}
    >
      <Timer className="h-3 w-3" />
      Trial {formatDuration(left)}
    </motion.div>
  );
}
