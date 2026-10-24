"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, CalendarClock, Compass, MapPin, Plus, Route, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { OrderStatusBadge, BountyStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/client/api";
import type { JourneyListItem } from "@/lib/client/types";
import { formatDateTime, formatDistance, formatDuration } from "@/lib/utils";

export default function JourneysPage() {
  const { data, error, isLoading } = useSWR<{ journeys: JourneyListItem[] }>("/api/journeys", fetcher, {
    refreshInterval: 25_000,
  });
  const journeys = data?.journeys ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your drives"
        title="Journeys"
        description="Every journey keeps its route corridor, discovered kitchens, bounties and active orders in one place."
        action={
          <Button asChild>
            <Link href="/customer/journeys/new"><Plus /> Plan a journey</Link>
          </Button>
        }
      />

      {error ? (
        <Card><CardContent className="p-6 text-sm text-red-700">Could not load journeys. {error.message}</CardContent></Card>
      ) : isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
        </div>
      ) : journeys.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No journeys yet"
          description="Search for a start and destination, choose how far off the road you'll detour, and we'll do the rest."
          action={<Button asChild><Link href="/customer/journeys/new">Plan your first journey</Link></Button>}
        />
      ) : (
        <div className="grid gap-3.5">
          {journeys.map((journey) => {
            const activeBounty = journey.bounties[0];
            const activeOrder = journey.orders[0];
            const ended = journey.status === "COMPLETED" || journey.status === "CANCELLED";
            return (
              <Card key={journey.id} className={ended ? "opacity-80" : "border-primary-200/80"}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={journey.status === "ACTIVE" ? "success" : journey.status === "PLANNED" ? "info" : "muted"}>
                          {journey.status.toLowerCase()}
                        </Badge>
                        {journey.isFallback ? <Badge variant="warning">Fallback route</Badge> : null}
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(journey.createdAt)}</span>
                      </div>

                      <h2 className="mt-2 flex flex-wrap items-center gap-1.5 font-display text-lg font-semibold">
                        <span className="truncate">{journey.startLabel}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{journey.endLabel}</span>
                      </h2>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Route className="h-3.5 w-3.5" /> {formatDistance(journey.routeDistanceMeters)}</span>
                        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {formatDuration(journey.routeDurationSeconds)}</span>
                        <span className="inline-flex items-center gap-1"><Compass className="h-3.5 w-3.5" /> {formatDistance(journey.corridorMeters)} corridor</span>
                        {journey.lastEtaAt ? <span>ETA updated {formatDateTime(journey.lastEtaAt)}</span> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {activeBounty ? (
                          <Link href={`/customer/bounties/${activeBounty.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-800 hover:bg-orange-100">
                            <Sparkles className="h-3 w-3" /> Bounty <BountyStatusBadge status={activeBounty.status} className="px-1.5 py-0" />
                          </Link>
                        ) : null}
                        {activeOrder ? (
                          <Link href={`/customer/orders/${activeOrder.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-800 hover:bg-primary-100">
                            {activeOrder.orderNumber} <OrderStatusBadge status={activeOrder.status} className="px-1.5 py-0" />
                          </Link>
                        ) : null}
                        {!activeBounty && !activeOrder && !ended ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" /> No active order — open the journey to order ahead</span>
                        ) : null}
                      </div>
                    </div>

                    <Button asChild variant="outline" className="shrink-0">
                      <Link href={`/customer/journeys/${journey.id}`}>Open <ArrowRight /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
