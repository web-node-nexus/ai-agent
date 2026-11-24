import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Safety",
  description:
    "TaraWorld safety — 18+, virtual companions, PG-13 moderation, crisis helplines, and reporting tools.",
};

const PILLARS = [
  {
    title: "Virtual companions",
    body: "Companions on TaraWorld are virtual. They must not claim to meet you offline, have a physical body, or replace real relationships.",
  },
  {
    title: "PG-13 romance only",
    body: "Light flirt and warm companionship are welcome. Explicit sexual content, exploitation, and illegal requests are blocked.",
  },
  {
    title: "Age gate",
    body: "You must be 18+. We collect date of birth confirmation before unlocking chat features.",
  },
  {
    title: "No spending pressure",
    body: "Companions never guilt-trip, threaten to leave, or push purchases. Paywalls belong in the product UI.",
  },
  {
    title: "Crisis care",
    body: "If you express self-harm or crisis signals, companions respond with care and share Tele-MANAS: 14416 / 1-800-891-4416 (India). They are not therapists.",
  },
  {
    title: "Report & block",
    body: "Something feels off? Use in-app reporting. Our team reviews flagged content and can restrict accounts that break the rules.",
  },
];

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Trust
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
        Safety centre
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Soft vibes, hard boundaries. TaraWorld is built so companionship stays
        comforting — not confusing, coercive, or unsafe.
      </p>

      <div className="mt-12 space-y-8">
        {PILLARS.map((p) => (
          <article key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="font-display text-xl">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {p.body}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-6">
        <h2 className="font-medium text-emerald-200">Need real help right now?</h2>
        <p className="mt-2 text-sm text-foreground/85">
          Tele-MANAS (India): <strong>14416</strong> or{" "}
          <strong>1-800-891-4416</strong>. If you are in immediate danger, contact
          local emergency services.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/contact">Contact us</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/privacy">Privacy & DPDP</Link>
        </Button>
      </div>
    </div>
  );
}
