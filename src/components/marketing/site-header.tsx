"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/characters", label: "People" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/safety", label: "Safety" },
  { href: "/faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "border-b border-white/10 bg-[color:var(--glass)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-foreground transition hover:opacity-90"
        >
          Tara<span className="text-gradient">World</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm transition",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-foreground bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-2xl px-3 text-sm text-foreground hover:bg-white/10"
          >
            Login
          </Link>
          <Link
            href="/login?next=/app"
            className="inline-flex h-9 items-center rounded-2xl bg-gradient-to-r from-rose-500 to-violet-600 px-4 text-sm font-medium text-white shadow-lg shadow-rose-900/30"
          >
            Login · 3 min free
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[color:var(--glass)] px-4 py-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-3 text-sm text-foreground hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 text-sm font-medium"
            >
              Login
            </Link>
            <Link
              href="/login?next=/app"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-rose-500 to-violet-600 px-5 text-sm font-medium text-white"
            >
              Login · 3 min free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
