import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "ai" | "gold" | "success" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        variant === "default" && "bg-white/10 text-white/90",
        variant === "ai" &&
          "bg-violet-500/20 text-violet-200 border border-violet-400/30",
        variant === "gold" &&
          "bg-amber-400/15 text-amber-200 border border-amber-300/30",
        variant === "success" && "bg-emerald-500/20 text-emerald-200",
        variant === "muted" && "bg-white/5 text-white/60",
        className
      )}
      {...props}
    />
  );
}
