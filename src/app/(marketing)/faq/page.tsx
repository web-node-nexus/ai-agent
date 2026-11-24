import type { Metadata } from "next";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FAQ_ITEMS } from "@/content/faq";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about TaraWorld — trial, pricing, companions, DPDP, and safety.",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
    url: absoluteUrl("/faq"),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Help
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
        FAQ
      </h1>
      <p className="mt-4 text-muted-foreground">
        Short answers in plain language — jargon optional.
      </p>
      <div className="mt-10">
        <FaqAccordion items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
