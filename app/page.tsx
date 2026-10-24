import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  BellRing,
  ChefHat,
  Clock3,
  Compass,
  CookingPot,
  Leaf,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { DemoLoginButtons } from "@/components/marketing/demo-login";
import { RouteMap } from "@/components/map/route-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const DEMO_ROUTE: [number, number][] = [
  [77.5946, 12.9716],
  [77.4845, 12.9172],
  [77.3866, 12.8018],
  [77.2802, 12.7209],
  [77.2065, 12.6514],
  [77.045, 12.5847],
  [76.8954, 12.5223],
  [76.6947, 12.4181],
  [76.6394, 12.2958],
];

const KITCHENS = [
  { id: "k1", lat: 12.8018, lng: 77.3866, label: "The Filter Coffee Stop", meta: "Bidadi · 12 min detour", kind: "restaurant" as const },
  { id: "k2", lat: 12.5847, lng: 77.045, label: "Maddur Tiffins", meta: "Maddur · 4 min detour", kind: "restaurant" as const },
  { id: "k3", lat: 12.4181, lng: 76.6947, label: "Srirangapatna Healthy Bowls", meta: "Srirangapatna · 6 min detour", kind: "restaurant" as const },
];

const STEPS = [
  {
    icon: Route,
    title: "Plot the drive",
    body: "Search any two places. Rapid Dine draws a real road route and a corridor around it — only kitchens near your road qualify.",
  },
  {
    icon: Sparkles,
    title: "Publish a bounty",
    body: "Pick dishes from one kitchen, set a fair budget, and broadcast the request. The first eligible kitchen to accept wins it.",
  },
  {
    icon: Timer,
    title: "Cooked to your ETA",
    body: "Your live ETA sets a start-cooking time. The kitchen is alerted just in time, so the food is hot when you pull in — not waiting under a lamp.",
  },
];

export default async function LandingPage() {
  const user = await getAuthUser();
  const dashboard = user?.role === "CUSTOMER" ? "/customer/dashboard" : user?.role === "RESTAURANT" ? "/restaurant/dashboard" : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="container-wide flex h-16 items-center gap-4">
          <Logo />
          <nav className="ml-auto hidden items-center gap-6 text-sm font-semibold text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#kitchens" className="hover:text-foreground">For kitchens</a>
            <a href="#trust" className="hover:text-foreground">Trust & data</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-6">
            {dashboard ? (
              <Button asChild>
                <Link href={dashboard}>Open dashboard <ArrowRight /></Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-in?mode=register">Get started <ArrowRight /></Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-radial-warm">
          <div className="container-wide grid gap-10 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:py-20">
            <div className="animate-fade-up">
              <Badge variant="outline" className="border-primary-200 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary-700">
                <MapPinned className="h-3.5 w-3.5" /> Route-aware food, timed to arrival
              </Badge>
              <h1 className="mt-5 max-w-xl font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
                Dinner is waiting where you&apos;re already going.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                Highway food usually means cold fries or a 40-minute detour. Rapid Dine matches your road trip with
                kitchens on the way, then times their cooking to your live ETA. You arrive, collect, and keep moving.
              </p>

              <div className="mt-7">
                <DemoLoginButtons />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary-600" /> Server-checked accounts</span>
                <span className="inline-flex items-center gap-1.5"><BadgeIndianRupee className="h-3.5 w-3.5 text-primary-600" /> Transparent fees</span>
                <span className="inline-flex items-center gap-1.5"><Leaf className="h-3.5 w-3.5 text-primary-600" /> Dietary flags on every dish</span>
              </div>
            </div>

            <div className="relative animate-fade-up lg:pl-4">
              <div className="surface overflow-hidden p-2">
                <RouteMap
                  route={DEMO_ROUTE}
                  markers={[
                    { id: "start", lat: 12.9716, lng: 77.5946, label: "Bengaluru", meta: "Journey starts", kind: "start" },
                    ...KITCHENS,
                    { id: "end", lat: 12.2958, lng: 76.6394, label: "Mysuru", meta: "Journey ends", kind: "end" },
                  ]}
                  fitKey="landing"
                  interactive={false}
                  zoom={8}
                  className="h-[300px] w-full sm:h-[380px]"
                />
              </div>

              <div className="pointer-events-none absolute -bottom-5 left-4 right-4 flex flex-wrap items-center gap-2 sm:left-8 sm:right-auto">
                <span className="glass inline-flex items-center gap-2 rounded-full border border-white/60 px-3.5 py-2 text-xs font-semibold shadow-soft">
                  <Clock3 className="h-3.5 w-3.5 text-primary-700" /> Arriving in 28 min
                </span>
                <span className="glass inline-flex items-center gap-2 rounded-full border border-white/60 px-3.5 py-2 text-xs font-semibold shadow-soft">
                  <CookingPot className="h-3.5 w-3.5 text-orange-600" /> Start cooking in 11 min
                </span>
              </div>

              <div className="mt-10 rounded-2xl border border-primary-200 bg-white/80 p-4 shadow-soft">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-700">
                  <BellRing className="h-3.5 w-3.5" /> Live bounty
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">2× Maddur vada + filter coffee</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Maddur Tiffins · accepted · ₹180 budget</p>
                  </div>
                  <Badge variant="success">Order accepted</Badge>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Demo data · Bengaluru → Mysuru corridor · map © OpenStreetMap
              </p>
            </div>
          </div>
        </section>

        {/* Value strip */}
        <section className="border-y border-border/60 bg-white/60">
          <div className="container-wide grid gap-4 py-6 sm:grid-cols-3">
            {[
              { icon: Compass, title: "Corridor matching", body: "Turf.js keeps only kitchens inside the road buffer you choose." },
              { icon: Timer, title: "Just-in-time cooking", body: "startCookingAfter = max(0, ETA − prep time), persisted per order." },
              { icon: ChefHat, title: "One kitchen wins", body: "A transaction-safe claim stops two kitchens accepting the same bounty." },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 rounded-2xl bg-background/70 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-700">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="container-wide py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps between the road and a warm meal.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              No pre-ordering hours ahead, no mystery pickup windows. Each step is a real, server-validated action.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="surface surface-hover p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-50 text-primary-700">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-3xl font-semibold text-primary-100">0{index + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Kitchens */}
        <section id="kitchens" className="border-y border-border/60 bg-primary-950 text-cream">
          <div className="container-wide grid gap-10 py-16 lg:grid-cols-2 lg:items-center sm:py-20">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300">For kitchens</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Fill the quiet gaps with travellers already passing your door.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream/70">
                You only see bounties you can actually fulfil: dishes you sell, a budget that works, capacity available,
                and a pickup inside your opening hours. Accept in one tap and let the scheduler tell you exactly when to
                start cooking.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Only eligible offers arrive",
                  "One-tap accept or reject with a reason",
                  "Prep-time-aware kitchen countdown",
                  "Live arrival ETA, never a precise address before pickup",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-cream/85">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" /> {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-2">
                <Button asChild variant="accent">
                  <Link href="/sign-in?mode=register&role=restaurant">List your kitchen <ArrowRight /></Link>
                </Button>
                <Button asChild variant="outline" className="border-cream/20 bg-transparent text-cream hover:bg-cream/10 hover:text-cream">
                  <Link href="/sign-in?role=restaurant">Partner sign in</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-cream/10 bg-cream/5 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-cream/60">Kitchen queue · demo</p>
                <Badge variant="accent">JIT scheduler on</Badge>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  { time: "11:42", dish: "2× Veg biryani", state: "Start cooking now", tone: "accent" as const },
                  { time: "11:55", dish: "1× Paneer wrap", state: "Start in 9 min", tone: "info" as const },
                  { time: "12:08", dish: "3× Filter coffee", state: "Accepted", tone: "success" as const },
                ].map((row) => (
                  <div key={row.dish} className="flex items-center justify-between gap-3 rounded-xl border border-cream/10 bg-primary-900/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-cream/50">{row.time}</span>
                      <span className="text-sm font-medium text-cream">{row.dish}</span>
                    </div>
                    <Badge variant={row.tone}>{row.state}</Badge>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-cream/50">
                Simulated kitchen view. In the real flow these timers come from the traveller&apos;s live ETA and each
                dish&apos;s preparation time.
              </p>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="container-wide py-16 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="eyebrow">Built for a demo, honest about it</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Real workflows, labelled simulations.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Rapid Dine is a hackathon build. Orders, bounties, auth and kitchen timing are real database operations.
                Payments are mocked, maps use OpenStreetMap, routing falls back to a computed line when OSRM is
                unreachable, and the food assistant switches to grounded rules without an LLM key.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild variant="outline"><Link href="/sign-in">Sign in</Link></Button>
                <Button asChild><Link href="/sign-in?mode=register">Create an account</Link></Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, title: "Auth you can audit", body: "JWT in an httpOnly cookie, bcrypt hashes, server-assigned roles, and a DB role re-check on every protected route." },
                { icon: BadgeIndianRupee, title: "Decimal money", body: "Prices and budgets use DECIMAL(10,2). Checkout adds a 3% service fee and ₹5 platform fee." },
                { icon: MapPinned, title: "Location with limits", body: "Precise points are only stored during a journey, pruned after six hours, and never exposed to kitchens until they win the order." },
                { icon: Sparkles, title: "Grounded assistant", body: "The assistant only cites restaurants and dishes from your current corridor. No key? Rules answer instead, clearly labelled." },
              ].map((item) => (
                <div key={item.title} className="surface p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary-700">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container-wide pb-16 sm:pb-20">
          <div className="relative overflow-hidden rounded-3xl bg-primary-900 px-6 py-10 text-cream sm:px-10 sm:py-12">
            <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-orange-500/20 blur-2xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300">Ready when you are</p>
                <h2 className="mt-2 max-w-lg font-display text-3xl font-semibold tracking-tight">
                  Take the demo for a drive.
                </h2>
                <p className="mt-2 max-w-lg text-sm text-cream/70">
                  One click signs you into a seeded traveller or kitchen account. Plan a Bengaluru → Mysuru journey in
                  under a minute.
                </p>
              </div>
              <DemoLoginButtons showHint={false} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="container-wide flex flex-col gap-3 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Logo compact />
          <p>Hackathon demo · no real payments · map data © OpenStreetMap contributors</p>
          <div className="flex gap-4">
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
            <Link href="/sign-in?mode=register" className="hover:text-foreground">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
