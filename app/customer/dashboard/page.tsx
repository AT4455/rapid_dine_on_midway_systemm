"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  CalendarClock,
  ChefHat,
  Clock3,
  Compass,
  MapPin,
  MessageCircle,
  ReceiptText,
  Route,
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { OrderStatusBadge, BountyStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/client/api";
import type { BountySummary, JourneyListItem, OrderSummary } from "@/lib/client/types";
import { formatCurrency, formatDateTime, formatDistance, formatDuration } from "@/lib/utils";

type ProfileResponse = {
  user: { name: string };
  profile: { defaultBudget: number; homeCity: string | null; dietaryPreferences: string[] } | null;
};

export default function CustomerDashboardPage() {
  const journeys = useSWR<{ journeys: JourneyListItem[] }>("/api/journeys", fetcher, { refreshInterval: 20_000 });
  const bounties = useSWR<{ bounties: BountySummary[] }>("/api/bounties", fetcher, { refreshInterval: 20_000 });
  const orders = useSWR<{ orders: OrderSummary[] }>("/api/orders", fetcher, { refreshInterval: 20_000 });
  const profile = useSWR<ProfileResponse>("/api/customer/profile", fetcher);

  const journeyList = journeys.data?.journeys ?? [];
  const bountyList = bounties.data?.bounties ?? [];
  const orderList = orders.data?.orders ?? [];

  const activeJourneys = journeyList.filter((j) => j.status === "PLANNED" || j.status === "ACTIVE");
  const openBounties = bountyList.filter((b) => b.status === "OPEN");
  const liveOrders = orderList.filter((o) => ["ACCEPTED", "PREPARING", "READY"].includes(o.status));
  const featuredJourney = activeJourneys[0] ?? journeyList[0];
  const featuredOrder = liveOrders[0];
  const featuredBounty = openBounties[0];
  const loading = journeys.isLoading || bounties.isLoading || orders.isLoading;
  const firstName = profile.data?.user.name?.split(" ")[0] ?? "traveller";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Traveller dashboard"
        title={`Good to see you, ${firstName}.`}
        description="Plan a drive, send a food bounty to kitchens on the way, and let the cooking line up with your arrival."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/customer/assistant"><MessageCircle /> Ask the food assistant</Link>
            </Button>
            <Button asChild>
              <Link href="/customer/journeys/new"><Route /> Plan a journey</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Route} label="Active journeys" value={loading ? "—" : activeJourneys.length} hint="Planned or on the road" />
        <StatCard icon={Sparkles} label="Open bounties" value={loading ? "—" : openBounties.length} hint="Waiting for a kitchen" tone="orange" />
        <StatCard icon={ReceiptText} label="Live orders" value={loading ? "—" : liveOrders.length} hint="Accepted → ready" tone="sky" />
        <StatCard
          icon={Wallet}
          label="Default budget"
          value={profile.isLoading ? "—" : formatCurrency(profile.data?.profile?.defaultBudget ?? 500)}
          hint={profile.data?.profile?.homeCity ? `Home base · ${profile.data.profile.homeCity}` : "Set in your profile"}
          tone="neutral"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <p className="eyebrow">Journey</p>
              <CardTitle className="mt-1">
                {featuredJourney ? `${featuredJourney.startLabel} → ${featuredJourney.endLabel}` : "No journey yet"}
              </CardTitle>
            </div>
            {featuredJourney ? <Badge variant={featuredJourney.isFallback ? "warning" : "success"}>{featuredJourney.isFallback ? "Demo route" : "Live route"}</Badge> : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : featuredJourney ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Distance" value={formatDistance(featuredJourney.routeDistanceMeters)} />
                  <Metric label="Drive time" value={formatDuration(featuredJourney.routeDurationSeconds)} />
                  <Metric label="Corridor" value={formatDistance(featuredJourney.corridorMeters)} />
                  <Metric label="Status" value={featuredJourney.status.toLowerCase()} />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm">
                    <Link href={`/customer/journeys/${featuredJourney.id}`}>
                      Open journey <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/customer/journeys/${featuredJourney.id}`}>
                      <Compass /> Discover kitchens
                    </Link>
                  </Button>
                  {featuredJourney.orders[0] ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/customer/orders/${featuredJourney.orders[0].id}`}>Track {featuredJourney.orders[0].orderNumber}</Link>
                    </Button>
                  ) : null}
                </div>

                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Planned {formatDateTime(featuredJourney.createdAt)} · provider {featuredJourney.provider}
                  {featuredJourney.isFallback ? " · routing provider unavailable, using a labelled fallback line" : ""}
                </p>
              </>
            ) : (
              <EmptyState
                icon={Route}
                title="Start with the road"
                description="Tell us where you're driving from and to. We'll show only kitchens inside your chosen corridor."
                action={
                  <Button asChild>
                    <Link href="/customer/journeys/new">Plan your first journey</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {featuredOrder ? (
            <Card className="border-primary-200 bg-primary-50/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="eyebrow">Live order</p>
                  <OrderStatusBadge status={featuredOrder.status} />
                </div>
                <CardTitle className="mt-1 text-lg">{featuredOrder.restaurant?.name ?? "Kitchen"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {featuredOrder.items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(", ")}
                </p>
                <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Ready {featuredOrder.estimatedReadyAt ? formatDateTime(featuredOrder.estimatedReadyAt) : "TBC"}</span>
                  <span>{formatCurrency(featuredOrder.total)}</span>
                </div>
                <Button asChild size="sm" className="w-full">
                  <Link href={`/customer/orders/${featuredOrder.id}`}>Track pickup <ArrowRight /></Link>
                </Button>
              </CardContent>
            </Card>
          ) : featuredBounty ? (
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="eyebrow text-orange-700">Bounty</p>
                  <BountyStatusBadge status={featuredBounty.status} />
                </div>
                <CardTitle className="mt-1 text-lg">
                  {featuredBounty.items.map((item) => `${item.quantity}× ${item.dishName}`).join(", ")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Budget {formatCurrency(featuredBounty.budget)} · {featuredBounty.offers.length} kitchen
                  {featuredBounty.offers.length === 1 ? "" : "s"} notified
                </p>
                <Button asChild size="sm" variant="accent" className="w-full">
                  <Link href={`/customer/bounties/${featuredBounty.id}`}>Watch the bounty <ArrowRight /></Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <p className="eyebrow">Next step</p>
                <CardTitle className="mt-1 text-lg">Find a kitchen on your road</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Open a journey to see verified kitchens with arrival estimates, detours, prep times and dietary tags.
                </p>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href="/customer/journeys"><Compass /> Browse journeys</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <p className="eyebrow">How timing works</p>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <div className="flex gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-100 text-primary-700"><Clock3 className="h-3.5 w-3.5" /></span>
                <p><span className="font-semibold text-foreground">startCookingAfter = max(0, ETA − prep time)</span> is stored on the order, not guessed in the browser.</p>
              </div>
              <div className="flex gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-700"><ChefHat className="h-3.5 w-3.5" /></span>
                <p>The kitchen gets one alert when it&apos;s time to cook, and sees a live arrival countdown.</p>
              </div>
              <div className="flex gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700"><MapPin className="h-3.5 w-3.5" /></span>
                <p>Live location is optional and only shared during the journey. It is pruned after six hours.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {journeyList.length > 1 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Recent journeys</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/customer/journeys">View all <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {journeyList.slice(1, 5).map((journey) => (
              <Link
                key={journey.id}
                href={`/customer/journeys/${journey.id}`}
                className="surface surface-hover flex items-center gap-3 p-3.5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><UtensilsCrossed className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{journey.startLabel} → {journey.endLabel}</span>
                  <span className="block text-[11px] text-muted-foreground">{formatDistance(journey.routeDistanceMeters)} · {formatDuration(journey.routeDurationSeconds)} · {journey.status.toLowerCase()}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}
