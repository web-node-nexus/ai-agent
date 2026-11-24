import Link from "next/link";

export const metadata = {
  title: "Account suspended",
};

export default function BannedPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--rose-glow),_transparent_55%),radial-gradient(ellipse_at_bottom,_var(--hero-glow),_transparent_50%)]"
      />
      <div className="relative z-10 max-w-md rounded-3xl border border-glass-border bg-glass p-8 text-center shadow-2xl backdrop-blur-xl">
        <p className="font-display text-3xl tracking-tight text-foreground">
          TaraWorld
        </p>
        <h1 className="mt-6 text-xl font-semibold text-danger">
          Account suspended
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This account has been restricted for violating our community
          guidelines. If you believe this is a mistake, contact support.
        </p>
        <Link
          href="/legal/terms"
          className="mt-8 inline-flex text-sm text-accent underline-offset-4 hover:underline"
        >
          Review our Terms
        </Link>
      </div>
    </div>
  );
}
