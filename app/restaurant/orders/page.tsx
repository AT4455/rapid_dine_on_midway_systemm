"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  ChefHat,
  Clock3,
  Filter,
  Phone,
  ReceiptText,
  ShieldAlert,
  Timer,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { Countdown } from "@/components/shared/countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/client/api";
import type { OrderSummary } from "@/lib/client/types";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

const FILTERS = [
  { value: "active", label: "Live" },
  { value: "all", label: "All" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export default function RestaurantOrdersPage() {
  const { data, error, isLoading, mutate } = useSWR<{ orders: OrderSummary[] }>("/api/orders", fetcher, {
    refreshInterval: 10_000,
  });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("active");
  const orders = data?.orders ?? [];

  const filtered = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "active") return orders.filter((order) => ["ACCEPTED", "PREPARING", "READY"].includes(order.status));
    return orders.filter((order) => order.status === filter);
  }, [filter, orders]);

  const activeCount = orders.filter((order) => ["ACCEPTED", "PREPARING", "READY"].includes(order.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kitchen orders"
        title="Orders"
        description="Every order comes from a bounty your kitchen accepted. Move it through accepted, preparing and ready, and only mark it complete once the traveller has collected it."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/restaurant/kitchen"><ChefHat /> Kitchen queue</Link></Button>
            <Button variant="ghost" size="sm" onClick={() => void mutate()}>Refresh</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filter</span>
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary-200 hover:text-foreground",
            )}
          >
            {option.label}
            {option.value === "active" && !isLoading ? ` · ${activeCount}` : ""}
          </button>
        ))}
      </div>

      {error ? (
        <Card><CardContent className="p-6 text-sm text-red-700">Could not load orders. {error.message}</CardContent></Card>
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={filter === "active" ? "No live orders" : "Nothing in this filter"}
          description={
            filter === "active"
              ? "Accept a bounty to create an order. It will appear here with the traveller's arrival ETA and your cooking countdown."
              : "Try another filter or refresh to see the latest state."
          }
          action={<Button asChild><Link href="/restaurant/bounties">Browse bounties</Link></Button>}
        />
      ) : (
        <div className="grid gap-3.5">
          {filtered.map((order) => {
            const live = ["ACCEPTED", "PREPARING", "READY"].includes(order.status);
            return (
              <Card key={order.id} className={live ? "border-primary-200/80" : undefined}>
                <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderStatusBadge status={order.status} />
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">{order.orderNumber}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                      {order.customer ? (
                        <Badge variant="outline"><UserRound /> {order.customer.name}</Badge>
                      ) : null}
                    </div>

                    <p className="mt-2 font-display text-lg font-semibold">
                      {order.items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(", ")}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {order.prepTimeMinutes} min prep</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> ready {order.estimatedReadyAt ? formatDateTime(order.estimatedReadyAt) : "TBC"}</span>
                      <span className="font-semibold text-foreground">{formatCurrency(order.total)}</span>
                      {order.customer?.phone ? (
                        <a className="inline-flex items-center gap-1 text-primary-700 hover:underline" href={`tel:${order.customer.phone}`}>
                          <Phone className="h-3.5 w-3.5" /> {order.customer.phone}
                        </a>
                      ) : null}
                    </div>

                    {order.status === "ACCEPTED" && order.cookingStartAt ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1.5 text-[11px] font-semibold text-primary-800">
                        <Countdown target={order.cookingStartAt} prefix="Planned start " />
                      </p>
                    ) : null}

                    {live && order.kitchenWarning ? (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.kitchenWarning}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {order.customer?.phone ? (
                      <Button asChild variant="ghost" size="sm"><a href={`tel:${order.customer.phone}`}><Phone /> Call</a></Button>
                    ) : null}
                    <Button asChild variant={live ? "default" : "outline"} size="sm">
                      <Link href={`/restaurant/orders/${order.id}`}>{live ? "Manage order" : "View order"} <ArrowRight /></Link>
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
