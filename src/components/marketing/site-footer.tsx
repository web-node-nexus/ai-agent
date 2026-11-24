import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/characters", label: "People" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/safety", label: "Safety" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refund-policy", label: "Refund policy" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-ink/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="font-display text-2xl tracking-tight">
              Tara<span className="text-gradient">World</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Make new friends online — warm chat, soft chemistry, voice calls.
              Respectful. 18+. Built for India.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/85 transition hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3 border-t border-white/10 pt-8 text-xs leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground/80">Note:</span>{" "}
            TaraWorld profiles are virtual. They cannot meet you offline and
            should not replace real friends, partners, or professional care.
          </p>
          <p>
            <span className="font-medium text-foreground/80">DPDP note:</span> We
            process personal data under India&apos;s Digital Personal Data
            Protection Act, 2023. See our{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>{" "}
            for rights, retention, and how to reach us.
          </p>
          <p className="pt-2">
            © 2026 TaraWorld. All rights reserved. 18+ only.
          </p>
        </div>
      </div>
    </footer>
  );
}
