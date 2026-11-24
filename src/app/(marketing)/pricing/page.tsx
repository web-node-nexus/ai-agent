import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Make new friends without surprise bills — 3 min free, chat plans ₹49 / ₹149, calls at 20 paise/min.",
};

const PLANS = [
  {
    name: "Weekly",
    price: formatPaise(4900),
    period: "7 days",
    highlight: false,
    perks: ["Chat with new friends", "Fair daily message cap", "PG-13 moderation", "Cancel anytime"],
  },
  {
    name: "Monthly",
    price: formatPaise(14900),
    period: "30 days",
    highlight: true,
    perks: [
      "Everything in Weekly",
      "Best value for regulars",
      "Wallet still used for video/images",
      "Priority support queue",
    ],
  },
];

const PACKS = [
  { label: "Starter", amount: 49 },
  { label: "Popular", amount: 99 },
  { label: "Plus", amount: 199 },
  { label: "Pro", amount: 499 },
];

const COMPARE = [
  { feature: "Text chat", trial: "3 min", sub: "Included", wallet: "—" },
  { feature: "Voice / video call", trial: "—", sub: "Wallet", wallet: "20 paise/min" },
  { feature: "Image generation", trial: "2 free", sub: "Wallet", wallet: "₹3 each" },
  { feature: "New friends to talk to", trial: "Yes", sub: "Yes", wallet: "Yes" },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Pricing
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
        Clear rates. Friendship first.
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Start with the trial. Subscribe to keep chatting. Use your wallet for
        voice calls and photos. No pressure to spend — paywalls stay honest in
        the UI.
      </p>

      <div className="mt-10 rounded-2xl border border-gold/30 bg-gold/10 px-5 py-4 text-sm">
        <span className="font-medium text-gold">Free trial:</span>{" "}
        <span className="text-foreground/90">
          ~3 minutes of chat for new verified users, plus 2 complimentary images.
        </span>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={
              plan.highlight
                ? "rounded-2xl border border-rose-400/40 bg-gradient-to-b from-rose-500/15 to-violet-600/10 p-7 shadow-xl shadow-rose-950/20"
                : "rounded-2xl border border-white/10 bg-white/[0.03] p-7"
            }
          >
            <p className="text-sm text-muted-foreground">{plan.name} chat</p>
            <p className="mt-2 font-display text-4xl text-gold">{plan.price}</p>
            <p className="mt-1 text-sm text-muted-foreground">per {plan.period}</p>
            <ul className="mt-6 space-y-2.5">
              {plan.perks.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {p}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8 w-full" variant={plan.highlight ? "default" : "secondary"}>
              <Link href="/login?next=/app">Get started</Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-16 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl">Usage rates</h2>
          <ul className="mt-5 space-y-4 text-sm">
            <li className="flex justify-between border-b border-white/10 pb-3">
              <span className="text-muted-foreground">Video / voice call</span>
              <span className="text-gold font-medium">20 paise / min</span>
            </li>
            <li className="flex justify-between border-b border-white/10 pb-3">
              <span className="text-muted-foreground">Image generation</span>
              <span className="text-gold font-medium">₹3 each</span>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-2xl">Wallet packs</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {PACKS.map((p) => (
              <div
                key={p.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <p className="text-xs text-muted-foreground">{p.label}</p>
                <p className="mt-1 font-display text-2xl text-gold">₹{p.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-16 overflow-x-auto">
        <h2 className="font-display text-2xl">Compare</h2>
        <table className="mt-6 w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Feature</th>
              <th className="py-3 pr-4 font-medium">Trial</th>
              <th className="py-3 pr-4 font-medium">Subscription</th>
              <th className="py-3 font-medium">Wallet</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((row) => (
              <tr key={row.feature} className="border-b border-white/5">
                <td className="py-3 pr-4 font-medium">{row.feature}</td>
                <td className="py-3 pr-4 text-muted-foreground">{row.trial}</td>
                <td className="py-3 pr-4 text-muted-foreground">{row.sub}</td>
                <td className="py-3 text-muted-foreground">{row.wallet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        Prices shown are GST-inclusive unless noted. Applicable GST is remitted as
        required under Indian tax rules. Payment processing via Razorpay. See{" "}
        <Link href="/refund-policy" className="underline underline-offset-2">
          Refund policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
        .
      </p>
    </div>
  );
}
