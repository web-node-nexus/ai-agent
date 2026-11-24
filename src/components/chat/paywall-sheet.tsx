"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crown, Wallet, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/utils";
import type { AccessState } from "@/types/database";

export function PaywallSheet({
  open,
  onClose,
  access,
  title = "Continue the vibe",
  description = "Subscribe for unlimited chat, or top up your wallet for video calls & images.",
}: {
  open: boolean;
  onClose: () => void;
  access?: AccessState | null;
  title?: string;
  description?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#140a1e] p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-muted-foreground hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {access && (
              <p className="mb-4 text-xs text-muted-foreground">
                Wallet:{" "}
                <span className="text-gold font-semibold">
                  {formatPaise(access.wallet_balance)}
                </span>
              </p>
            )}

            <div className="flex flex-col gap-3">
              <Button asChild size="lg" variant="gold" className="w-full">
                <Link href="/app/subscription">
                  <Crown className="h-4 w-4" />
                  View plans
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="w-full">
                <Link href="/app/wallet">
                  <Wallet className="h-4 w-4" />
                  Top up wallet
                </Link>
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
