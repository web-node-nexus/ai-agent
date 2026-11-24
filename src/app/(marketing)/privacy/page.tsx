import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "TaraWorld Privacy Policy — DPDP-aware notice on data we collect, why, retention, and your rights.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-4xl tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 23 November 2026</p>
      <div className="mt-10 space-y-8 text-sm leading-relaxed">
        <p className="text-muted-foreground">
          This notice explains how TaraWorld (“we”) processes personal data in line with
          the Digital Personal Data Protection Act, 2023 (DPDP) and related rules. We aim
          for clear purposes, limited retention, and workable rights requests.
        </p>

        <section>
          <h2 className="font-display text-xl text-foreground">1. Data Fiduciary</h2>
          <p className="mt-3 text-muted-foreground">
            TaraWorld operates as the Data Fiduciary for personal data collected through
            the website and app. Contact for privacy requests: use our{" "}
            <Link href="/contact" className="underline underline-offset-2">
              Contact form
            </Link>{" "}
            with subject “Privacy / DPDP”.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">2. What we collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Account data: name, email, gender (optional), date of birth, phone (if verified).</li>
            <li>Usage data: chats, call metadata, image requests, device fingerprint signals for abuse prevention.</li>
            <li>Payment data: processed by Razorpay; we store payment references and wallet ledger entries, not full card numbers.</li>
            <li>Support messages you send via Contact.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">3. Purpose & lawful basis</h2>
          <p className="mt-3 text-muted-foreground">
            We process data to provide companionship features, age-gate the product,
            prevent fraud/abuse, process payments, improve safety moderation, and respond
            to support. Processing is based on your consent and/or legitimate uses
            necessary to deliver the Service you request, consistent with DPDP.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">4. Retention</h2>
          <p className="mt-3 text-muted-foreground">
            Default retention for conversational memory and related logs is configured
            (typically up to 365 days unless a shorter period is set or you request
            deletion earlier). Payment records may be kept longer where tax or dispute
            rules require.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">5. Sharing</h2>
          <p className="mt-3 text-muted-foreground">
            We use processors such as cloud hosting, Supabase, AI model providers,
            Upstash (rate limits), and Razorpay. We do not sell personal data. We may
            disclose information if required by law or to protect users and the Service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">6. Your rights</h2>
          <p className="mt-3 text-muted-foreground">
            Subject to DPDP and applicable exemptions, you may request access,
            correction, erasure, and withdrawal of consent where processing is
            consent-based. Use the Contact form. We may need to verify your identity
            before fulfilling a request.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">7. Children</h2>
          <p className="mt-3 text-muted-foreground">
            The Service is 18+ only. We do not knowingly collect data from children. If
            you believe a minor has registered, contact us for deletion.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">8. Security</h2>
          <p className="mt-3 text-muted-foreground">
            We use industry-standard controls (encryption in transit, access controls,
            rate limiting). No method is perfectly secure; please use a strong unique
            password and keep OTPs private.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">9. Changes</h2>
          <p className="mt-3 text-muted-foreground">
            We may update this Policy. Material changes will be reflected by the “Last
            updated” date and, where appropriate, in-product notice.
          </p>
        </section>
      </div>
    </div>
  );
}
