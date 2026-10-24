import Link from "next/link";
import { ArrowLeft, Clock3, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export function AuthLayout({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary-950 px-10 py-10 text-cream lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-[0.16]" aria-hidden>
          <svg viewBox="0 0 600 800" className="h-full w-full" fill="none">
            <path d="M110 720C150 620 90 560 170 480s180-40 180-130 90-120 120-210" stroke="#faf7f0" strokeWidth="3" strokeDasharray="10 12" />
            <circle cx="110" cy="720" r="10" fill="#f97316" />
            <circle cx="470" cy="140" r="10" fill="#faf7f0" />
            <circle cx="250" cy="430" r="7" fill="#8fc2a3" />
            <circle cx="350" cy="350" r="7" fill="#8fc2a3" />
          </svg>
        </div>

        <Logo variant="light" href="/" />

        <div className="relative my-auto max-w-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300">{eyebrow ?? "Rapid Dine"}</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight">
            Great road food shouldn&apos;t require perfect timing.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-cream/70">
            Publish a bounty along your route. The kitchen that accepts cooks to your live ETA, so the food is ready
            when you pull up.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-cream/80">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cream/10"><MapPinned className="h-4 w-4" /></span>
              Corridor-filtered kitchens, not a city-wide list
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cream/10"><Clock3 className="h-4 w-4" /></span>
              Prep-aware kitchen alerts, down to the minute
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cream/10"><ShieldCheck className="h-4 w-4" /></span>
              One kitchen wins each bounty, transaction-safe
            </li>
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-cream/50">
          <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Hackathon demo · mock payments</span>
          <Link href="/" className="inline-flex items-center gap-1 hover:text-cream">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-4 lg:hidden">
          <Logo />
          <Link href="/" className="text-xs font-semibold text-muted-foreground hover:text-foreground">Home</Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
