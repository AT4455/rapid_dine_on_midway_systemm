import Link from "next/link";
import { ArrowRight, ChefHat, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const OPTIONS = [
  {
    href: "/register/customer",
    icon: UtensilsCrossed,
    title: "I'm travelling",
    body: "Plan a route, find kitchens on the way, and order to your arrival time.",
    bullets: ["Route-aware discovery", "Budget-first bounties", "Live pickup ETA"],
    cta: "Create a traveller account",
  },
  {
    href: "/register/restaurant",
    icon: ChefHat,
    title: "I run a kitchen",
    body: "Receive only the bounties you can actually cook and hand over on time.",
    bullets: ["Corridor + capacity matching", "JIT cooking queue", "Menu and order control"],
    cta: "Register a restaurant",
  },
];

export function RegisterChoice() {
  return (
    <div>
      <Badge variant="outline" className="border-primary-200 text-primary-700">New account</Badge>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Which side of the counter?</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Roles are assigned by the server and checked again on every protected route.
      </p>

      <div className="mt-6 space-y-3">
        {OPTIONS.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="surface surface-hover group block p-5"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-50 text-primary-700">
                <option.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold">{option.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{option.body}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {option.bullets.map((bullet) => (
                    <span key={bullet} className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                      {bullet}
                    </span>
                  ))}
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-800">
                  {option.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-primary-800 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
