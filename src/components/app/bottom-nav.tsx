"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, MessageCircle, Wallet, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app", label: "Home", icon: Home, match: (p: string) => p === "/app" },
  {
    href: "/app/chats",
    label: "Chats",
    icon: MessageCircle,
    match: (p: string) => p.startsWith("/app/chats") || p.startsWith("/app/chat"),
  },
  {
    href: "/app/wallet",
    label: "Wallet",
    icon: Wallet,
    match: (p: string) => p.startsWith("/app/wallet") || p.startsWith("/app/subscription"),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
    match: (p: string) => p.startsWith("/app/settings"),
  },
] as const;

export function shouldHideAppChrome(pathname: string) {
  return (
    pathname.startsWith("/app/chat/") ||
    pathname.startsWith("/app/call/")
  );
}

export function BottomNav() {
  const pathname = usePathname();
  if (shouldHideAppChrome(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[color:var(--glass)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Main"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="relative flex flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-rose-200" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-x-3 top-1.5 h-9 rounded-2xl bg-gradient-to-r from-rose-500/20 to-violet-600/20"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span className="relative z-10">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

