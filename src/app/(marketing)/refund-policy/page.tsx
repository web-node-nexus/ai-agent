import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "TaraWorld refund policy for wallet packs, subscriptions, failed payments, and GST considerations.",
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-4xl tracking-tight">Refund Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 23 November 2026</p>
      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-display text-xl text-foreground">1. Overview</h2>
          <p className="mt-3">
            Digital goods on TaraWorld (chat subscriptions and wallet credits) are
            generally non-refundable once delivered, except as described below or where
            required by Indian consumer law.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-foreground">2. Failed or duplicate payments</h2>
          <p className="mt-3">
            If Razorpay charges you but wallet/subscription credit is not applied within
            a reasonable time, contact us with the payment ID. Verified failed or
            duplicate captures are refunded or credited.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-foreground">3. Unused wallet packs</h2>
          <p className="mt-3">
            Unused wallet balance from a pack purchased within the last 7 days may be
            eligible for a refund request if no material usage (calls/images) has
            occurred. Partial usage typically means a partial or declined refund at our
            discretion.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-foreground">4. Subscriptions</h2>
          <p className="mt-3">
            You can cancel renewal to stop future charges. Mid-cycle refunds are not
            guaranteed once chat access for the period has been unlocked, except for
            billing errors or statutory rights.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-foreground">5. Consumed usage</h2>
          <p className="mt-3">
            Minutes already called and images already generated are consumed digital
            services and are not refundable.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-foreground">6. GST & processing</h2>
          <p className="mt-3">
            Refunds are processed via the original payment method where possible and may
            take 5–10 business days. GST treatment follows applicable rules and payment
            gateway timelines.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl text-foreground">7. How to request</h2>
          <p className="mt-3">
            Use the{" "}
            <Link href="/contact" className="underline underline-offset-2 text-foreground">
              Contact form
            </Link>{" "}
            with your registered email, payment ID, and reason. We may ask for additional
            verification.
          </p>
        </section>
      </div>
    </div>
  );
}
