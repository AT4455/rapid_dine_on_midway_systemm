import Link from "next/link";
import { ArrowLeft, Compass, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary-700 text-white shadow-lift">
          <UtensilsCrossed className="h-7 w-7" />
        </div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-700">404 · off the route</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          This stop isn&apos;t on the map.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The page you were looking for has moved, expired, or never existed. Head back to the road and we&apos;ll find
          you a kitchen that is actually on the way.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">
              <ArrowLeft /> Back to Rapid Dine
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/customer/journeys">
              <Compass /> Browse journeys
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
