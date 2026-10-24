import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "primary" | "orange" | "sky" | "neutral";
  className?: string;
}) {
  const tones = {
    primary: "bg-primary-50 text-primary-700",
    orange: "bg-orange-50 text-orange-600",
    sky: "bg-sky-50 text-sky-700",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card p-4 shadow-soft sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
