"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  ChefHat,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Loader2,
  Radio,
  ReceiptText,
  ShieldAlert,
  Sparkles,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Countdown } from "@/components/shared/countdown";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/client/api";
import type { RestaurantDashboard } from "@/lib/client/types";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/utils";

export default function RestaurantDashboardPage() {
  const { data, error, isLoading, mutate } = useSWR<RestaurantDashboard>(
    "/api/restaurant/dashboard",
    fetcher,
    { refreshInterval: 10_000 },
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-2/3" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6 text-sm">
          <p className="font-semibold text-red-700">Could not load your kitchen dashboard.</p>
          <p className="text-muted-foreground">{error?.message ?? "Please try again."}</p>
          <Button size="sm" variant="outline" onClick={() => void mutate()}>
            <Loader2 /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { restaurant, counts, today, pendingOffers, queue, workload, scheduler } = data;
  const utilisation = Math.min(100, Math.max(0, workload.utilisation));
  const verified = restaurant.verificationStatus === "VERIFIED";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kitchen workspace"
        title={restaurant.name}
        description={`${restaurant.cuisine} · ${restaurant.address}. You receive bounties only when every dish, your opening hours, capacity and the traveller's budget line up.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/restaurant/kitchen"><ChefHat /> Kitchen queue</Link></Button>
            <Button asChild><Link href="/restaurant/bounties"><Sparkles /> Bounties {pendingOffers > 0 ? `· ${pendingOffers}` : ""}</Link></Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={verified ? "success" : "warning"}>
          <span className={`h-1.5 w-1.5 rounded-full ${verified ? "bg-emerald-600" : "bg-amber-500"}`} />
          {verified ? "Verified kitchen" : `Verification ${restaurant.verificationStatus.toLowerCase()}`}
        </Badge>
        <Badge variant={restaurant.isActive ? "success" : "muted"}>{restaurant.isActive ? "Accepting orders" : "Paused"}</Badge>
        <Badge variant="outline"><Timer /> Capacity {restaurant.capacityPerHour}/hour</Badge>
        <Badge variant="outline"><Clock3 /> Workload {workload.prepMinutesQueued} prep min queued</Badge>
        {scheduler.running ? (
          <Badge variant="info"><Radio className="h-3 w-3" /> Scheduler online</Badge>
        ) : (
          <Badge variant="warning"><Radio className="h-3 w-3" /> Scheduler idle</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ReceiptText} label="Today's orders" value={today.orderCount} hint={`${today.completedCount} completed`} />
        <StatCard icon={CheckCircle2} label="Completed today" value={today.completedCount} hint="Mock payments, no real charges" tone="sky" />
        <StatCard icon={IndianRupee} label="Revenue today" value={formatCurrency(today.revenue)} hint="Completed orders only" tone="neutral" />
        <StatCard
          icon={Sparkles}
          label="Pending bounties"
          value={pendingOffers}
          hint={pendingOffers ? "First to accept wins the order" : "No open offers right now"}
          tone="orange"
        />
      </div>

      {queue.length > 0 && queue.some((order) => order.kitchenWarning) ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Timing warning: </span>
            A traveller&apos;s ETA leaves less time than your preparation needs, or their ETA is stale. Open the order to
            see the detail and tell the traveller if you will be late.
          </span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><ChefHat className="h-4 w-4" /> Live kitchen queue</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Ordered by planned cooking start. Updates arrive over the kitchen socket.</p>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href="/restaurant/kitchen">Open queue <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {queue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/40 px-4 py-10 text-center">
                <ChefHat className="mx-auto h-6 w-6 text-primary-600" />
                <p className="mt-2 text-sm font-semibold">The kitchen is clear</p>
                <p className="mt-1 text-xs text-muted-foreground">Accepted bounties appear here with a JIT cooking countdown.</p>
              </div>
            ) : (
              queue.map((order) => (
                <div key={order.id} className="rounded-xl border border-border p-3.5 transition-colors hover:border-primary-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={order.status} />
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">{order.orderNumber}</span>
                    <span className="text-[11px] text-muted-foreground">for {order.customerName}</span>
                    {order.cookingStartAt && order.status === "ACCEPTED" ? (
                      <span className="ml-auto text-[11px] text-primary-800">
                        <Countdown target={order.cookingStartAt} prefix="Start " />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm font-semibold">{order.itemPreview}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</span>
                    <span>{order.prepTimeMinutes} min prep</span>
                    <span>{formatCurrency(order.total)}</span>
                    <span>Ready {order.estimatedReadyAt ? formatDateTime(order.estimatedReadyAt) : "TBC"}</span>
                  </div>
                  {order.kitchenWarning ? (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.kitchenWarning}
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/restaurant/orders/${order.id}`}>Manage <ArrowRight /></Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <p className="eyebrow">Load</p>
              <CardTitle className="text-lg">Kitchen utilisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <p className="font-display text-3xl font-semibold">{workload.activeOrders}<span className="text-base font-normal text-muted-foreground"> active</span></p>
                <span className="text-xs font-semibold text-muted-foreground">{utilisation}% of {workload.capacityPerHour}/h</span>
              </div>
              <Progress value={utilisation} />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Utilisation compares active orders with your hourly capacity. It is an approximation for the demo, not a
                queue simulation. At capacity, new bounties stop being offered until a slot frees up.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <MiniMetric label="Accepted" value={counts.ACCEPTED ?? 0} />
                <MiniMetric label="Preparing" value={counts.PREPARING ?? 0} />
                <MiniMetric label="Ready" value={counts.READY ?? 0} />
                <MiniMetric label="Prep minutes" value={workload.prepMinutesQueued} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary-200 bg-primary-50/40">
            <CardHeader className="pb-2">
              <p className="eyebrow">Just-in-time cooking</p>
              <CardTitle className="text-base">Scheduler {scheduler.running ? "is running" : "is not running"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                Every order stores <span className="font-semibold text-foreground">startCookingAfter = max(0, traveller ETA − prep time)</span>.
                The scheduler emits a start-cooking alert when that moment arrives.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-foreground">
                <MiniMetric label="Last tick" value={scheduler.lastTickAt ? timeAgo(scheduler.lastTickAt) : "Not yet"} />
                <MiniMetric label="Alerts started" value={scheduler.started} />
                <MiniMetric label="Bounties expired" value={scheduler.expiredBounties} />
                <MiniMetric label="Server time" value={new Date(data.serverNow).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" className="justify-start"><Link href="/restaurant/orders"><ReceiptText /> Orders</Link></Button>
              <Button asChild variant="outline" size="sm" className="justify-start"><Link href="/restaurant/menu"><UtensilsCrossed /> Menu</Link></Button>
              <Button asChild variant="outline" size="sm" className="justify-start"><Link href="/restaurant/bounties"><Sparkles /> Bounties</Link></Button>
              <Button asChild variant="outline" size="sm" className="justify-start"><Link href="/restaurant/profile">Profile</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-white/70 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}
