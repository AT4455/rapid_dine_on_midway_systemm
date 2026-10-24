"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  CalendarClock,
  ChefHat,
  Clock3,
  Compass,
  MapPin,
  Navigation,
  Route,
  Sparkles,
  Square,
  Star,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { RouteMap } from "@/components/map/route-map";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BountyStatusBadge, KitchenBadge, OrderStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher, postJson } from "@/lib/client/api";
import type { JourneyDetailResponse } from "@/lib/client/types";
import { formatCurrency, formatDateTime, formatDistance, formatDuration } from "@/lib/utils";

export default function JourneyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error, isLoading, mutate } = useSWR<JourneyDetailResponse>(`/api/journeys/${id}`, fetcher, {
    refreshInterval: 20_000,
  });
  const [stopping, setStopping] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-[320px] w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={Route}
        title="Journey unavailable"
        description={error?.message ?? "This journey could not be loaded. It may belong to another account."}
        action={<Button asChild><Link href="/customer/journeys">Back to journeys</Link></Button>}
      />
    );
  }

  const journey = data.journey;
  const restaurants = data.restaurants;
  const bounty = journey.bounties[0];
  const order = journey.orders[0];
  const ended = journey.status === "COMPLETED" || journey.status === "CANCELLED";

  const markers = [
    { id: "start", lat: Number(journey.startLatitude), lng: Number(journey.startLongitude), label: journey.startLabel, meta: "Journey start", kind: "start" as const },
    ...restaurants.slice(0, 8).map((restaurant) => ({
      id: restaurant.id,
      lat: restaurant.latitude,
      lng: restaurant.longitude,
      label: restaurant.name,
      meta: `${restaurant.etaMinutes} min away · ${formatDistance(restaurant.detourMeters)} detour`,
      kind: "restaurant" as const,
    })),
    { id: "end", lat: Number(journey.endLatitude), lng: Number(journey.endLongitude), label: journey.endLabel, meta: "Journey end", kind: "end" as const },
  ];

  async function stopTracking() {
    setStopping(true);
    try {
      await postJson(`/api/journeys/${id}/stop`);
      toast.success("Journey ended and precise location history deleted.");
      await mutate();
    } catch (stopError) {
      toast.error(stopError instanceof Error ? stopError.message : "Could not stop the journey.");
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${journey.status.toLowerCase()} journey`}
        title={`${journey.startLabel} → ${journey.endLabel}`}
        description={`Planned ${formatDateTime(journey.createdAt)} · ${formatDistance(journey.routeDistanceMeters)} · ${formatDuration(journey.routeDurationSeconds)} driving. ${restaurants.length} kitchen${restaurants.length === 1 ? "" : "s"} inside ${formatDistance(journey.corridorMeters)}.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/customer/journeys"><ArrowLeft /> Journeys</Link></Button>
            {!ended ? (
              <Button variant="outline" size="sm" onClick={() => void stopTracking()} disabled={stopping}>
                <Square /> {stopping ? "Ending…" : "End journey"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={journey.status === "ACTIVE" ? "success" : journey.status === "PLANNED" ? "info" : "muted"}>{journey.status.toLowerCase()}</Badge>
        <Badge variant={journey.isFallback ? "warning" : "outline"}>{journey.isFallback ? "Fallback route" : `Provider · ${journey.provider}`}</Badge>
        <Badge variant="outline"><Compass /> {formatDistance(journey.corridorMeters)} corridor</Badge>
        {journey.lastEtaAt ? <Badge variant="outline"><Timer /> ETA updated {formatDateTime(journey.lastEtaAt)}</Badge> : null}
      </div>

      {journey.isFallback ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          The routing provider was unreachable when this journey was planned, so Rapid Dine stored a straight-line
          fallback route. Distances, ETAs and corridor matches are approximate. Re-plan when the provider is available
          for exact road routing.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-2">
            <RouteMap route={journey.routeGeometry} markers={markers} fitKey={journey.id} interactive className="h-[300px] w-full sm:h-[400px]" />
          </div>
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <Metric label="Start" value={journey.startLabel} />
            <Metric label="Destination" value={journey.endLabel} />
            <Metric label="Drive" value={formatDuration(journey.routeDurationSeconds)} />
            <Metric label="Corridor" value={formatDistance(journey.corridorMeters)} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {order ? (
            <Card className="border-primary-200 bg-primary-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">Active order</p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <CardTitle className="text-lg">{order.restaurant?.name ?? "Kitchen"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{order.orderNumber} · {formatCurrency(order.total)}</p>
                <p className="text-sm">{order.items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(", ")}</p>
                <Button asChild size="sm" className="w-full">
                  <Link href={`/customer/orders/${order.id}`}>Track pickup <ArrowRight /></Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {bounty ? (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow text-orange-700">Bounty on this journey</p>
                  <BountyStatusBadge status={bounty.status} />
                </div>
                <CardTitle className="text-lg">{bounty.items.map((item) => `${item.quantity}× ${item.dishName}`).join(", ")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Budget {formatCurrency(bounty.budget)} · {bounty.offers.length} kitchen{bounty.offers.length === 1 ? "" : "s"} offered · expires {formatDateTime(bounty.expiresAt)}
                </p>
                <Button asChild size="sm" variant="accent" className="w-full">
                  <Link href={`/customer/bounties/${bounty.id}`}>Open bounty <ArrowRight /></Link>
                </Button>
              </CardContent>
            </Card>
          ) : !order && !ended ? (
            <Card>
              <CardHeader className="pb-2">
                <p className="eyebrow">Order ahead</p>
                <CardTitle className="text-lg">Pick a kitchen below</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                Build a cart from one kitchen, set a budget, and publish a bounty. Eligible kitchens on this corridor
                can accept — the first to claim it gets the order.
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <p className="eyebrow">Privacy</p>
              <CardTitle className="text-base">Location, only while needed</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-muted-foreground">
              {journey.lastLocationAt ? `Last shared ${formatDateTime(journey.lastLocationAt)}. ` : "No location shared yet. "}
              Precise points exist only for this journey, are pruned after six hours, and are visible to a kitchen only
              after it wins your order. Ending the journey deletes them immediately.
            </CardContent>
          </Card>
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold">Kitchens on your corridor</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sorted by arrival time. Suitability compares your drive ETA with the kitchen&apos;s prep time.
            </p>
          </div>
          <Badge variant="outline"><MapPin /> {restaurants.filter((r) => r.openNow).length} open now</Badge>
        </div>

        {restaurants.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={UtensilsCrossed}
            title="No kitchens in this corridor"
            description="Try a wider corridor when planning, or choose a different destination. We never show kitchens that aren't near your road."
            action={<Button asChild><Link href="/customer/journeys/new">Plan a wider route</Link></Button>}
          />
        ) : (
          <div className="mt-4 grid gap-3.5">
            {restaurants.map((restaurant) => (
              <Card key={restaurant.id} className="surface-hover">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold">{restaurant.name}</h3>
                        <KitchenBadge open={restaurant.openNow} />
                        <Badge variant={restaurant.suitability === "great" ? "success" : restaurant.suitability === "tight" ? "warning" : "accent"}>
                          {restaurant.suitabilityLabel}
                        </Badge>
                        {restaurant.activeOrders >= restaurant.capacityPerHour ? <Badge variant="danger">At capacity</Badge> : null}
                      </div>

                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{restaurant.cuisine}</span>
                        <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> {restaurant.rating.toFixed(1)} ({restaurant.ratingCount})</span>
                        <span className="inline-flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> {formatDistance(restaurant.detourMeters)} detour</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> arrive ~{restaurant.etaMinutes} min</span>
                      </p>

                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{restaurant.description}</p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {restaurant.menuPreview.map((item) => (
                          <span key={item.id} className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium">
                            {item.name} · {formatCurrency(item.price)} · {item.prepTimeMinutes}m
                          </span>
                        ))}
                        {restaurant.dietaryTags.includes("VEGAN") ? <Badge variant="success">Vegan options</Badge> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><ChefHat className="h-3.5 w-3.5" /> {restaurant.activeOrders}/{restaurant.capacityPerHour} slots</span>
                        <span className="inline-flex items-center gap-1"><BadgeIndianRupee className="h-3.5 w-3.5" /> {formatCurrency(restaurant.priceRange.min)}–{formatCurrency(restaurant.priceRange.max)}</span>
                        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {restaurant.openingTime}–{restaurant.closingTime}</span>
                        <span>{restaurant.address}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 lg:w-44">
                      <Button asChild>
                        <Link href={`/customer/restaurants/${restaurant.id}?journeyId=${journey.id}`}>
                          <UtensilsCrossed /> View menu
                        </Link>
                      </Button>
                      {!restaurant.openNow ? <p className="text-center text-[10px] text-muted-foreground">Closed right now — browsing only</p> : null}
                      {restaurant.suitability === "preorder" ? (
                        <p className="inline-flex items-center justify-center gap-1 text-center text-[10px] text-amber-700"><Sparkles className="h-3 w-3" /> Pre-order to make it</p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}
