"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Settings,
  CreditCard,
  Phone,
  ImageIcon,
  ShieldAlert,
  ScrollText,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/characters", label: "Characters", icon: Sparkles },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/calls", label: "Calls", icon: Phone },
  { href: "/admin/images", label: "Images", icon: ImageIcon },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldAlert },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(({ href, label, icon: Icon, ...rest }) => {
        const exact = "exact" in rest && rest.exact;
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-gradient-to-r from-rose-500/25 to-violet-600/25 text-white border border-white/15"
                : "text-white/65 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_var(--rose-glow),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_var(--hero-glow),_transparent_50%),var(--background)] text-foreground">
      <div className="flex min-h-dvh">
        <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-black/20 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <Link href="/admin" className="font-display text-xl tracking-tight">
              TaraWorld
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">Admin console</p>
          </div>
          {nav}
          <div className="mt-auto border-t border-white/10 p-4">
            <Link
              href="/app"
              className="text-xs text-muted-foreground hover:text-white"
            >
              ← Back to app
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-glass/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <button
              type="button"
              aria-label="Toggle menu"
              className="rounded-xl border border-white/15 bg-white/5 p-2"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="font-display text-lg">Admin</span>
          </header>

          {open && (
            <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl lg:hidden">
              {nav}
            </div>
          )}

          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
