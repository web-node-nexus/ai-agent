import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact TaraWorld support — billing, privacy requests, and product feedback.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Support
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Contact</h1>
      <p className="mt-4 text-muted-foreground">
        Billing, privacy requests, safety reports, or just feedback — drop a note.
        We usually reply within 2 business days.
      </p>
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <ContactForm />
      </div>
    </div>
  );
}
