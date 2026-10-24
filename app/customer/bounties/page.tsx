"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, ChefHat, Clock3, Route, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BountyStatusBadge, OrderStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Countdown } from "@/components/shared/countdown";
import { fetcher, postJson } from "@/lib/client/api";
import type { BountySummary } from "@/lib/client/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useState } from "react";

export default function BountiesPage() {
  const { data, error, isLoading, mutate } = useSWR<{ bounties: BountySummary[] }>("/api/bounties", fetcher, {
    refreshInterval: 15_000,
  });
  const [cancelling, setCancelling] = useState<string | null>(null);
  const bounties = data?.bounties ?? [];

  async function cancel(id: string) {
    if (!window.confirm("Cancel this bounty? Kitchens that received it will no longer be able to accept.")) return;
    setCancelling(id);
    try {
      await postJson(`/api/bounties/${id}/cancel`);
      toast.success("Bounty cancelled.");
      await mutate();
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : "Could not cancel the bounty.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Food requests"
        title="Bounties"
        description="A bounty is a budgeted request broadcast to eligible kitchens on one journey. Only one kitchen can accept it."
        action={<Button asChild><Link href="/customer/journeys"><Route /> Order from a journey</Link></Button>}
      />

      {error ? (
        <Card><CardContent className="p-6 text-sm text-red-700">Could not load bounties. {error.message}</CardContent></Card>
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>
      ) : bounties.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No bounties yet"
          description="A bounty starts from a journey: choose a kitchen on your corridor, fill a cart, then publish your budget."
          action={<Button asChild><Link href="/customer/journeys">Find a kitchen</Link></Button>}
        />
      ) : (
        <div className="grid gap-3.5">
          {bounties.map((bounty) => {
            const pendingOffers = bounty.offers.filter((offer) => offer.status === "PENDING").length;
            return (
              <Card key={bounty.id} className={bounty.status === "OPEN" ? "border-orange-200/80" : undefined}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <BountyStatusBadge status={bounty.status} />
                        <span className="text-[11px] text-muted-foreground">Created {formatDateTime(bounty.createdAt)}</span>
                        {bounty.preferredRestaurant ? <Badge variant="outline">Preferred · {bounty.preferredRestaurant.name}</Badge> : null}
                      </div>

                      <h2 className="mt-2 font-display text-lg font-semibold">
                        {bounty.items.map((item) => `${item.quantity}× ${item.dishName}`).join(", ")}
                      </h2>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><ChefHat className="h-3.5 w-3.5" /> {bounty.acceptedRestaurant?.name ?? `${bounty.offers.length} kitchen${bounty.offers.length === 1 ? "" : "s"} notified`}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> pickup ~{bounty.pickupEtaMinutes} min</span>
                        <span>Budget {formatCurrency(bounty.budget)}</span>
                        {bounty.status === "OPEN" ? <span className="inline-flex items-center gap-1"><Countdown target={bounty.expiresAt} prefix="expires in " /></span> : null}
                        {bounty.status === "OPEN" ? <span>{pendingOffers} pending offer{pendingOffers === 1 ? "" : "s"}</span> : null}
                      </div>

                      {bounty.order ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-xs">
                          <span className="font-semibold">{bounty.order.orderNumber}</span>
                          <OrderStatusBadge status={bounty.order.status} />
                          <span className="text-muted-foreground">{formatCurrency(bounty.order.total)}</span>
                          <Button asChild size="sm" variant="ghost" className="ml-auto h-7">
                            <Link href={`/customer/orders/${bounty.order.id}`}>Track <ArrowRight /></Link>
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/customer/bounties/${bounty.id}`}>Open <ArrowRight /></Link>
                      </Button>
                      {bounty.status === "OPEN" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-700 hover:text-red-800"
                          onClick={() => void cancel(bounty.id)}
                          disabled={cancelling === bounty.id}
                        >
                          <XCircle /> {cancelling === bounty.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      ) : null}
                    </div>
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
