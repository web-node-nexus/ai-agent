"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { motion } from "framer-motion";
import { Crown, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccess, useInvalidateAccess } from "@/hooks/use-access";
import { formatPaise } from "@/lib/utils";
import type { WalletPack } from "@/types/database";

type LedgerRow = {
  id: string;
  type: string;
  amount_paise: number;
  description?: string | null;
  created_at: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: unknown) => void) => void;
    };
  }
}

const FALLBACK_PACKS: WalletPack[] = [
  { key: "pack_49", amount_inr: 49, paise: 4900, label: "Starter" },
  { key: "pack_99", amount_inr: 99, paise: 9900, label: "Popular" },
  { key: "pack_199", amount_inr: 199, paise: 19900, label: "Plus" },
  { key: "pack_499", amount_inr: 499, paise: 49900, label: "Pro" },
];

export default function WalletPage() {
  const { data: access, isLoading } = useAccess();
  const invalidate = useInvalidateAccess();
  const [packs, setPacks] = useState<WalletPack[]>(FALLBACK_PACKS);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [rzReady, setRzReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("wallet_ledger")
            .select("id, type, amount_paise, description, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(40);
          if (!cancelled && data) setLedger(data as LedgerRow[]);
        }
      } catch {
        /* use defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buyPack = useCallback(
    async (pack: WalletPack) => {
      if (!rzReady || !window.Razorpay) {
        toast.error("Payment SDK still loading");
        return;
      }
      setBuying(pack.key);
      try {
        const res = await fetch("/api/wallet/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ packKey: pack.key }),
        });
        const order = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(order.error ?? "Order failed");

        const key =
          order.key ??
          order.keyId ??
          process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

        const rzp = new window.Razorpay({
          key,
          amount: order.amount ?? pack.paise,
          currency: order.currency ?? "INR",
          name: "TaraWorld",
          description: `${pack.label} wallet pack`,
          order_id: order.orderId ?? order.id,
          handler: async (response: unknown) => {
            try {
              const verify = await fetch("/api/wallet/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(response),
              });
              const body = await verify.json().catch(() => ({}));
              if (!verify.ok) throw new Error(body.error ?? "Verify failed");
              toast.success("Wallet topped up");
              invalidate();
              const { createClient } = await import("@/lib/supabase/client");
              const supabase = createClient();
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                const { data } = await supabase
                  .from("wallet_ledger")
                  .select("id, type, amount_paise, description, created_at")
                  .eq("user_id", user.id)
                  .order("created_at", { ascending: false })
                  .limit(40);
                if (data) setLedger(data as LedgerRow[]);
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Verify failed");
            }
          },
          theme: { color: "#a78bfa" },
        });
        rzp.open();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Checkout failed");
      } finally {
        setBuying(null);
      }
    },
    [invalidate, rzReady]
  );

  return (
    <div className="flex flex-1 flex-col px-4 pb-4 pt-6">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRzReady(true)}
      />

      <header className="mb-6">
        <h1 className="font-display text-3xl">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay-as-you-go for video calls and images.
        </p>
      </header>

      <Card className="mb-6 overflow-hidden border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-white/5 to-violet-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium text-muted-foreground">
            <Wallet className="h-4 w-4" />
            Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-10 w-32 animate-pulse rounded bg-white/10" />
          ) : (
            <p className="font-display text-4xl text-gold">
              {formatPaise(access?.wallet_balance ?? 0)}
            </p>
          )}
          <Button asChild variant="ghost" size="sm" className="mt-3 px-0 text-violet-200">
            <Link href="/app/subscription">
              <Crown className="h-3.5 w-3.5" />
              Prefer unlimited chat? See plans
            </Link>
          </Button>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Top-up packs
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {packs.map((pack, i) => (
          <motion.div
            key={pack.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <button
              type="button"
              disabled={buying === pack.key}
              onClick={() => void buyPack(pack)}
              className="flex w-full flex-col items-start rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-amber-400/35 hover:bg-white/[0.07] active:scale-[0.98] disabled:opacity-60"
            >
              <Badge variant="gold">{pack.label}</Badge>
              <p className="mt-3 font-display text-2xl text-gold">
                ₹{pack.amount_inr}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatPaise(pack.paise)} credit
              </p>
              {buying === pack.key && (
                <Loader2 className="mt-2 h-4 w-4 animate-spin text-amber-200" />
              )}
            </button>
          </motion.div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Recent activity
      </h2>
      {ledger.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <ul className="space-y-2">
          {ledger.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
            >
              <div>
                <p className="capitalize">{row.type.replace(/_/g, " ")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("en-IN")}
                </p>
              </div>
              <span
                className={
                  row.amount_paise >= 0 ? "text-gold font-semibold" : "text-danger"
                }
              >
                {row.amount_paise >= 0 ? "+" : ""}
                {formatPaise(row.amount_paise)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
