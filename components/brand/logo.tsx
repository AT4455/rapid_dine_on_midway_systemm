import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-primary-900 text-cream shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none">
        <path
          d="M6 23c0-5 4-6 7-8s4-4 4-7"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeDasharray="0.1 4.2"
        />
        <circle cx="6" cy="23" r="2.6" fill="currentColor" />
        <circle cx="17" cy="8" r="2.6" fill="#f97316" />
        <path d="M22 14h4M22 18h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".7" />
      </svg>
    </span>
  );
}

export function Logo({
  href = "/",
  variant = "dark",
  compact = false,
  className,
}: {
  href?: string;
  variant?: "dark" | "light";
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Rapid Dine home">
      <LogoMark />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-[19px] font-semibold tracking-tight",
              variant === "light" ? "text-cream" : "text-foreground",
            )}
          >
            Rapid Dine
          </span>
          <span className={cn("mt-1 text-[9px] font-bold uppercase tracking-[0.22em]", variant === "light" ? "text-cream/60" : "text-primary-600")}>
            Eat along the way
          </span>
        </span>
      ) : null}
    </Link>
  );
}
