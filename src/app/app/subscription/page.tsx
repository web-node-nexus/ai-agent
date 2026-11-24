"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { motion } from "framer-motion";
import { Check, Crown, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccess, useInvalidateAccess } from "@/hooks/use-access";
import { formatPaise } from "@/lib/utils";
import type { SubPlan } from "@/types/database";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: unknown) => void) => void;
    };
  }
}

const FALLBACK_PLANS: SubPlan[] = [
  {
    key: "weekly",
    name: "Weekly",
    price_paise: 4900,
    period_days: 7,
    razorpay_plan_id: "",
  },
  {
    key: "monthly",
    name: "Monthly",
    price_paise: 14900,
    period_days: 30,
    razorpay_plan_id: "",
  },
];

type SubStatus = {
  active?: boolean;
  planKey?: string;
  currentPeriodEnd?: string;
  status?: string;
  autopay?: boolean;
};

export default function SubscriptionPage() {
  const { data: access } = useAccess();
  const invalidate = useInvalidateAccess();
  const [plans, setPlans] = useState<SubPlan[]>(FALLBACK_PLANS);
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rzReady, setRzReady] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions/status", {
        credentials: "include",
      });
      if (!res.ok) return;
      const body = await res.json();
      if (body.plans) {
        const list = Object.values(body.plans) as SubPlan[];
        if (list.length) setPlans(list);
      }
      setStatus(body.subscription ?? body);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (access?.has_active_subscription) {
      setStatus((s) => ({
        ...s,
        active: true,
        status: s?.status ?? "active",
        autopay: s?.autopay ?? true,
      }));
    }
  }, [access?.has_active_subscription]);

  const subscribe = useCallback(
    async (plan: SubPlan) => {
      if (!rzReady || !window.Razorpay) {
        toast.error("Payment SDK still loading");
        return;
      }
      setBusy(plan.key);
      try {
        const res = await fetch("/api/subscriptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ plan_key: plan.key }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not start subscription");

        const key =
          body.key_id ??
          body.key ??
          body.keyId ??
          process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

        const subscriptionId =
          body.razorpay_subscription_id ??
          body.subscriptionId ??
          body.id;

        if (!subscriptionId) {
          throw new Error("Missing subscription id from payment provider");
        }

        if (body.short_url || body.shortUrl) {
          window.location.href = body.short_url || body.shortUrl;
          return;
        }

        const rzp = new window.Razorpay({
          key,
          name: "TaraWorld",
          description: `${plan.name} · Autopay on`,
          subscription_id: subscriptionId,
          prefill: body.prefill ?? {},
          notes: {
            plan_key: plan.key,
            autopay: "1",
          },
          recurring: "1",
          theme: { color: "#e879a9" },
          handler: async (response: {
            razorpay_payment_id?: string;
            razorpay_subscription_id?: string;
            razorpay_signature?: string;
          }) => {
            try {
              if (
                response.razorpay_payment_id &&
                response.razorpay_subscription_id &&
                response.razorpay_signature
              ) {
                const verify = await fetch("/api/subscriptions/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_subscription_id: response.razorpay_subscription_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                });
                const vBody = await verify.json().catch(() => ({}));
                if (!verify.ok) {
                  throw new Error(vBody.error ?? "Could not confirm payment");
                }
              }
              toast.success("Autopay is on — you’ll be charged each cycle");
              setStatus({
                active: true,
                planKey: plan.key,
                status: "active",
                autopay: true,
              });
              invalidate();
              void refreshStatus();
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Payment received — syncing…"
              );
              invalidate();
              void refreshStatus();
            }
          },
        });

        rzp.on("payment.failed", () => {
          toast.error("Payment failed. Try again.");
        });

        rzp.open();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Subscribe failed");
      } finally {
        setBusy(null);
      }
    },
    [invalidate, refreshStatus, rzReady]
  );

  const cancel = useCallback(async () => {
    setBusy("cancel");
    try {
      const res = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Cancel failed");
      toast.success("Autopay cancelled — access lasts until period end");
      setStatus((s) => ({
        ...s,
        active: false,
        status: "cancelled",
        autopay: false,
      }));
      invalidate();
      void refreshStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  }, [invalidate, refreshStatus]);

  const active = Boolean(status?.active || access?.has_active_subscription);

  return (
    <div className="flex flex-1 flex-col px-4 pb-4 pt-6">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRzReady(true)}
      />

      <header className="mb-6">
        <h1 className="font-display text-3xl">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay once — Autopay renews every cycle until you cancel.
        </p>
      </header>

      <Card className="mb-4 border-emerald-400/20 bg-emerald-500/10">
        <CardContent className="flex items-start gap-3 p-4">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <div className="text-sm leading-relaxed text-emerald-50/95">
            <p className="font-medium text-emerald-100">Autopay included</p>
            <p className="mt-1 text-emerald-100/80">
              Your first payment saves the mandate. Next week / next month the
              same amount is deducted automatically via Razorpay. Cancel anytime
              from this page.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 border-violet-400/25 bg-gradient-to-br from-violet-500/15 to-rose-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-amber-300" />
            Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {active ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Active</Badge>
                {status?.autopay !== false && (
                  <Badge variant="gold">Autopay on</Badge>
                )}
              </div>
              {status?.planKey && (
                <p className="text-sm capitalize text-foreground">
                  Plan: {status.planKey}
                </p>
              )}
              {status?.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground">
                  Next charge / access till{" "}
                  {new Date(status.currentPeriodEnd).toLocaleDateString("en-IN")}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={busy === "cancel"}
                onClick={() => void cancel()}
              >
                {busy === "cancel" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Cancel Autopay
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active plan. Subscribe below — Autopay starts on first payment.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="border-white/10 bg-white/[0.04]">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl">{plan.name}</h2>
                    {plan.key === "monthly" && (
                      <Badge variant="gold">Best value</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-2xl font-semibold text-gold">
                    {formatPaise(plan.price_paise)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {plan.period_days <= 7 ? "week" : "month"}
                    </span>
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-400" />
                      Chat after trial
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-400" />
                      Autopay every {plan.period_days <= 7 ? "week" : "month"}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-400" />
                      Cancel anytime
                    </li>
                  </ul>
                </div>
                <Button
                  variant={plan.key === "monthly" ? "gold" : "default"}
                  disabled={active || busy === plan.key}
                  onClick={() => void subscribe(plan)}
                >
                  {busy === plan.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : active ? (
                    "Current"
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
