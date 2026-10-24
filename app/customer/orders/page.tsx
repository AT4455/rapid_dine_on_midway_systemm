"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, ChefHat, Clock3, MapPin, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/client/api";
import type { OrderSummary } from "@/lib/client/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function CustomerOrdersPage() {
  const { data, error, isLoading } = useSWR<{ orders: OrderSummary[] }>("/api/orders", fetcher, {
    refreshInterval: 15_000,
  });
  const orders = data?.orders ?? [];
  const active = orders.filter((order) => ["ACCEPTED", "PREPARING", "READY"].includes(order.status));
  const past = orders.filter((order) => !["ACCEPTED", "PREPARING", "READY"].includes(order.status));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pickups"
        title="Orders"
        description="Accepted orders show a live kitchen status and pickup ETA. Past orders keep an immutable item snapshot."
        action={<Button asChild variant="outline"><Link href="/customer/journeys"><MapPin /> Order from a journey</Link></Button>}
      />

      {error ? (
        <Card><CardContent className="p-6 text-sm text-red-700">Could not load orders. {error.message}</CardContent></Card>
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No orders yet"
          description="When a kitchen accepts your bounty, the order appears here with its pickup countdown."
          action={<Button asChild><Link href="/customer/journeys">Open a journey</Link></Button>}
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live pickups</h2>
              <div className="grid gap-3.5">
                {active.map((order) => <OrderCard key={order.id} order={order} live />)}
              </div>
            </section>
          ) : null}

          {past.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Past orders</h2>
              <div className="grid gap-3.5">
                {past.map((order) => <OrderCard key={order.id} order={order} />)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, live }: { order: OrderSummary; live?: boolean }) {
  return (
    <Card className={live ? "border-primary-200/80" : "opacity-90"}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">{order.orderNumber}</span>
            <span className="text-[11px] text-muted-foreground">{formatDateTime(order.createdAt)}</span>
          </div>
          <p className="mt-1.5 font-display text-lg font-semibold">{order.restaurant?.name ?? "Kitchen"}</p>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
            {order.items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ChefHat className="h-3.5 w-3.5" /> {order.prepTimeMinutes} min prep</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> ready {order.estimatedReadyAt ? formatDateTime(order.estimatedReadyAt) : "TBC"}</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
        <Button asChild variant={live ? "default" : "outline"} className="shrink-0">
          <Link href={`/customer/orders/${order.id}`}>{live ? "Track" : "View"} <ArrowRight /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
