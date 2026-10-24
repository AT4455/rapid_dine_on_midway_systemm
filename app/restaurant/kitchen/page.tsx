"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  ChefHat,
  CheckCircle2,
  Clock3,
  Flame,
  PackageCheck,
  Radio,
  RefreshCw,
  ShieldAlert,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Countdown } from "@/components/shared/countdown";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher, patchJson } from "@/lib/client/api";
import type { RestaurantDashboard } from "@/lib/client/types";
import { cn, formatCurrency, formatDateTime, timeAgo } from "@/lib/utils";

type QueueOrder = RestaurantDashboard["queue"][number];

export default function KitchenQueuePage() {
  const { data, error, isLoading, mutate } = useSWR<RestaurantDashboard>(
    "/api/restaurant/dashboard",
    fetcher,
    { refreshInterval: 5_000 },
  );
  const [working, setWorking] = useState<string | null>(null);

  async function advance(order: QueueOrder, status: "PREPARING" | "READY" | "COMPLETED") {
    setWorking(`${order.id}:${status}`);
    try {
      await patchJson(`/api/orders/${order.id}/status`, { status });
      toast.success(
        status === "PREPARING"
          ? `${order.orderNumber}: cooking started.`
          : status === "READY"
            ? `${order.orderNumber}: ready for pickup.`
            : `${order.orderNumber}: collected.`,
      );
      await mutate();
    } catch (statusError) {
      toast.error(statusError instanceof Error ? statusError.message : "Could not update the order.");
      await mutate();
    } finally {
      setWorking(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card><CardContent className="p-6 text-sm text-red-700">Could not load the kitchen queue. {error?.message}</CardContent></Card>
    );
  }

  const { queue, workload, scheduler } = data;
  const cooking = queue.filter((order) => order.status === "PREPARING");
  const ready = queue.filter((order) => order.status === "READY");
  const upcoming = queue.filter((order) => order.status === "ACCEPTED");
  const warnings = queue.filter((order) => order.kitchenWarning);
  const utilisation = Math.min(100, Math.max(0, workload.utilisation));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Just-in-time kitchen"
        title="Kitchen queue"
        description="Work the queue by planned start time. The server computes each start from the traveller's live ETA minus preparation time, so cooking finishes as they arrive."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void mutate()}><RefreshCw /> Refresh</Button>
            <Button asChild size="sm"><Link href="/restaurant/orders"><UtensilsCrossed /> All orders</Link></Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={scheduler.running ? "info" : "muted"}>
          <Radio className="h-3 w-3" /> Scheduler {scheduler.running ? "running" : "idle"}
        </Badge>
        <Badge variant="outline">Last tick {scheduler.lastTickAt ? timeAgo(scheduler.lastTickAt) : "not yet"}</Badge>
        <Badge variant="outline">{queue.length} active order{queue.length === 1 ? "" : "s"}</Badge>
        {warnings.length > 0 ? <Badge variant="warning"><ShieldAlert className="h-3 w-3" /> {warnings.length} timing warning{warnings.length === 1 ? "" : "s"}</Badge> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Flame} label="Cooking now" value={cooking.length} hint="Started, not yet ready" tone="orange" />
        <StatCard icon={PackageCheck} label="Ready" value={ready.length} hint="Waiting at the counter" tone="sky" />
        <StatCard icon={Clock3} label="Upcoming" value={upcoming.length} hint="Timed to the traveller's ETA" />
        <StatCard icon={Timer} label="Queued prep" value={`${workload.prepMinutesQueued} min`} hint={`${utilisation}% utilisation`} tone="neutral" />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-[180px] flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Utilisation</span>
              <span className="text-muted-foreground">{workload.activeOrders} of {workload.capacityPerHour}/hour</span>
            </div>
            <Progress value={utilisation} className="mt-1.5" />
          </div>
          <p className="max-w-md text-[10px] leading-relaxed text-muted-foreground">
            When the queue reaches capacity, new bounties stop being offered. Prep minutes are the sum of each order&apos;s
            planned preparation, not a real-time simulation.
          </p>
        </CardContent>
      </Card>

      {warnings.length > 0 ? (
        <div className="space-y-2">
          {warnings.map((order) => (
            <div key={order.id} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{order.orderNumber}: </span>
                {order.kitchenWarning}{" "}
                <Link className="underline" href={`/restaurant/orders/${order.id}`}>Open order</Link>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 px-6 py-14 text-center">
          <ChefHat className="mx-auto h-7 w-7 text-primary-600" />
          <p className="mt-2 font-display text-lg font-semibold">Nothing on the pass</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Accepted bounties appear here with a start-cooking countdown. Until then, keep your menu and opening hours fresh.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline" size="sm"><Link href="/restaurant/bounties">Browse bounties</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/restaurant/menu">Update menu</Link></Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-3">
          <QueueColumn
            title="Cooking now"
            hint="Start checking packing and pickup notes."
            icon={Flame}
            tone="orange"
            orders={cooking}
            working={working}
            onAdvance={advance}
            actionLabel="Mark ready"
            actionStatus="READY"
          />
          <QueueColumn
            title="Ready at the counter"
            hint="Complete only after the traveller collects."
            icon={PackageCheck}
            tone="sky"
            orders={ready}
            working={working}
            onAdvance={advance}
            actionLabel="Mark collected"
            actionStatus="COMPLETED"
          />
          <QueueColumn
            title="Upcoming"
            hint="Start on time, not too early."
            icon={Clock3}
            tone="primary"
            orders={upcoming}
            working={working}
            onAdvance={advance}
            actionLabel="Start cooking"
            actionStatus="PREPARING"
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">How the countdown is calculated</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3">
          <p><span className="font-semibold text-foreground">1. Arrival ETA</span><br />The traveller&apos;s journey plan or latest shared position gives an arrival time at your kitchen.</p>
          <p><span className="font-semibold text-foreground">2. Prep time</span><br />Your menu items set the dominant prep time plus a small handling cost for extra quantities.</p>
          <p><span className="font-semibold text-foreground">3. Start time</span><br /><span className="font-mono text-[10px]">startCookingAfter = max(0, ETA − prep)</span>. The scheduler alerts you when it arrives, and a late ETA raises a warning.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function QueueColumn({
  title,
  hint,
  icon: Icon,
  tone,
  orders,
  working,
  onAdvance,
  actionLabel,
  actionStatus,
}: {
  title: string;
  hint: string;
  icon: typeof Flame;
  tone: "orange" | "sky" | "primary";
  orders: QueueOrder[];
  working: string | null;
  onAdvance: (order: QueueOrder, status: "PREPARING" | "READY" | "COMPLETED") => Promise<void>;
  actionLabel: string;
  actionStatus: "PREPARING" | "READY" | "COMPLETED";
}) {
  const tones = {
    orange: "bg-orange-50 text-orange-700",
    sky: "bg-sky-50 text-sky-700",
    primary: "bg-primary-50 text-primary-700",
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", tones[tone])}><Icon className="h-4 w-4" /></span>
        <div>
          <h2 className="font-display text-base font-semibold">{title} <span className="text-muted-foreground">· {orders.length}</span></h2>
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
          Nothing here.
        </div>
      ) : (
        orders.map((order) => {
          const startingNow = order.cookingStartAt ? new Date(order.cookingStartAt).getTime() <= Date.now() : true;
          const busy = working?.startsWith(order.id);
          return (
            <Card key={order.id} className={order.kitchenWarning ? "border-amber-200" : undefined}>
              <CardContent className="space-y-2.5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground">{order.orderNumber}</span>
                  <span className="ml-auto text-[11px] font-semibold">{formatCurrency(order.total)}</span>
                </div>

                <div>
                  <p className="text-sm font-semibold">{order.itemPreview}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">for {order.customerName} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}</p>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{order.prepTimeMinutes} min prep</span>
                  <span>·</span>
                  <span>ready {order.estimatedReadyAt ? formatDateTime(order.estimatedReadyAt) : "TBC"}</span>
                </div>

                {order.status === "ACCEPTED" ? (
                  <div className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold",
                    startingNow ? "bg-orange-50 text-orange-800" : "bg-primary-50 text-primary-800",
                  )}>
                    <Clock3 className="h-3.5 w-3.5" />
                    {startingNow ? (
                      "Start now — preparation time is tight"
                    ) : (
                      <Countdown target={order.cookingStartAt} prefix="Start " />
                    )}
                  </div>
                ) : null}

                {order.kitchenWarning ? (
                  <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-900">
                    <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" /> {order.kitchenWarning}
                  </p>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => void onAdvance(order, actionStatus)}
                    disabled={Boolean(busy)}
                  >
                    {actionStatus === "READY" ? <PackageCheck /> : actionStatus === "COMPLETED" ? <CheckCircle2 /> : <Flame />}
                    {busy ? "Updating…" : actionLabel}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/restaurant/orders/${order.id}`} aria-label={`Open ${order.orderNumber}`}><ArrowRight /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
}
