import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "TaraWorld Terms of Service — eligibility, acceptable use, subscriptions, and virtual companions.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-4xl tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 23 November 2026</p>
      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-display text-xl">1. Agreement</h2>
          <p className="mt-3 text-muted-foreground">
            By creating an account or using TaraWorld (“Service”), you agree to these
            Terms and our{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the Service.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">2. Eligibility</h2>
          <p className="mt-3 text-muted-foreground">
            You must be at least 18 years old and legally able to enter a contract in
            India (or your place of residence). We may request age confirmation and
            phone verification.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">3. Virtual companions</h2>
          <p className="mt-3 text-muted-foreground">
            All characters on TaraWorld are virtual companions. They are not real
            people, cannot meet you offline, and do not provide medical, legal, or
            financial advice. Content is for entertainment and companionship only.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">4. Acceptable use</h2>
          <p className="mt-3 text-muted-foreground">
            You agree not to: seek or share illegal content; attempt to bypass
            safety/moderation; harass others; scrape or reverse-engineer the Service;
            share credentials; or use the Service to harm minors. We may suspend or
            terminate accounts that violate these rules.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">5. Subscriptions, wallet & GST</h2>
          <p className="mt-3 text-muted-foreground">
            Chat plans, wallet packs, and usage fees are described on the Pricing page.
            Prices are generally GST-inclusive. Payments are processed by Razorpay.
            Refunds follow our{" "}
            <Link href="/refund-policy" className="underline underline-offset-2">
              Refund Policy
            </Link>
            .
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">6. Intellectual property</h2>
          <p className="mt-3 text-muted-foreground">
            TaraWorld branding, software, and character designs are owned by us or our
            licensors. You retain rights to content you submit, and grant us a license
            to operate the Service (including moderation and memory features).
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">7. Disclaimers & liability</h2>
          <p className="mt-3 text-muted-foreground">
            The Service is provided “as is.” To the fullest extent permitted by law, we
            disclaim warranties of uninterrupted availability and fitness for a
            particular purpose. Our aggregate liability is limited to amounts you paid
            us in the three months preceding the claim, except where liability cannot be
            limited under applicable law.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">8. Contact</h2>
          <p className="mt-3 text-muted-foreground">
            Questions about these Terms:{" "}
            <Link href="/contact" className="underline underline-offset-2">
              Contact us
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
