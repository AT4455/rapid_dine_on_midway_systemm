"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Clock3,
  MapPin,
  ReceiptText,
  Sparkles,
  Timer,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { RouteMap } from "@/components/map/route-map";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { BountyStatusBadge, OrderStatusBadge } from "@/components/shared/status-badge";
import { Countdown } from "@/components/shared/countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher, postJson } from "@/lib/client/api";
import { useRoomSubscription } from "@/lib/client/socket";
import type { BountyDetail } from "@/lib/client/types";
import { formatCurrency, formatDateTime, formatDistance, formatDuration } from "@/lib/utils";
import { useState } from "react";

export default function BountyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error, isLoading, mutate } = useSWR<{ bounty: BountyDetail; viewer: string }>(
    `/api/bounties/${id}`,
    fetcher,
    { refreshInterval: 10_000 },
  );
  const [cancelling, setCancelling] = useState(false);
  useRoomSubscription("bounty", id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-[280px] w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Bounty unavailable"
        description={error?.message ?? "This bounty could not be loaded."}
        action={<Button asChild><Link href="/customer/bounties">Back to bounties</Link></Button>}
      />
    );
  }

  const bounty = data.bounty;
  const pending = bounty.offers.filter((offer) => offer.status === "PENDING").length;
  const accepted = bounty.offers.filter((offer) => offer.status === "ACCEPTED").length;
  const rejected = bounty.offers.filter((offer) => offer.status === "REJECTED").length;
  const journey = bounty.journey;
  const open = bounty.status === "OPEN";

  const markers = [
    { id: "start", lat: Number(journey.startLatitude), lng: Number(journey.startLongitude), label: journey.startLabel, kind: "start" as const },
    { id: "end", lat: Number(journey.endLatitude), lng: Number(journey.endLongitude), label: journey.endLabel, kind: "end" as const },
  ];

  async function cancel() {
    if (!window.confirm("Cancel this bounty? Kitchens will be notified that it is no longer available.")) return;
    setCancelling(true);
    try {
      await postJson(`/api/bounties/${id}/cancel`);
      toast.success("Bounty cancelled.");
      await mutate();
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : "Could not cancel.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bounty"
        title={bounty.items.map((item) => `${item.quantity}× ${item.dishName}`).join(", ")}
        description={`Budget ${formatCurrency(bounty.budget)} · ${journey.startLabel} → ${journey.endLabel} · ${bounty.offers.length} eligible kitchen${bounty.offers.length === 1 ? "" : "s"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/customer/bounties"><ArrowLeft /> Bounties</Link></Button>
            {open ? (
              <Button variant="outline" size="sm" className="text-red-700" onClick={() => void cancel()} disabled={cancelling}>
                <XCircle /> {cancelling ? "Cancelling…" : "Cancel bounty"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <BountyStatusBadge status={bounty.status} />
        {open ? <Countdown target={bounty.expiresAt} prefix="Expires in " className="text-xs" /> : null}
        <Badge variant="outline"><Clock3 /> Created {formatDateTime(bounty.createdAt)}</Badge>
        {bounty.preferredRestaurant ? <Badge variant="outline">Preferred kitchen · {bounty.preferredRestaurant.name}</Badge> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-2">
            <RouteMap
              route={journey.routeGeometry}
              markers={markers}
              fitKey={journey.id}
              interactive
              className="h-[260px] w-full"
            />
          </div>
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <Metric label="Distance" value={formatDistance(journey.routeDistanceMeters)} />
            <Metric label="Drive" value={formatDuration(journey.routeDurationSeconds)} />
            <Metric label="Pickup ETA" value={`${bounty.pickupEtaMinutes} min`} />
            <Metric label="Corridor" value={formatDistance(journey.corridorMeters)} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {bounty.acceptedRestaurant ? (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader className="pb-2">
                <p className="eyebrow text-emerald-800">Kitchen accepted</p>
                <CardTitle className="text-lg">{bounty.acceptedRestaurant.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>{bounty.acceptedRestaurant.cuisine}</p>
                {bounty.acceptedRestaurant.address ? <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5" /> {bounty.acceptedRestaurant.address}</p> : null}
                {bounty.acceptedRestaurant.pickupInstructions ? (
                  <p className="rounded-lg bg-white/70 p-2.5 text-[11px] leading-relaxed">{bounty.acceptedRestaurant.pickupInstructions}</p>
                ) : null}
                {bounty.order ? (
                  <Button asChild size="sm" className="mt-1 w-full">
                    <Link href={`/customer/orders/${bounty.order.id}`}>
                      <ReceiptText /> Track order {bounty.order.orderNumber}
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className={open ? "border-orange-200 bg-orange-50/40" : undefined}>
              <CardHeader className="pb-2">
                <p className="eyebrow text-orange-800">Waiting for a kitchen</p>
                <CardTitle className="text-lg">
                  {pending} kitchen{pending === 1 ? "" : "s"} can still accept
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>Only verified kitchens inside your corridor, with every requested dish, enough capacity and a matching budget received this bounty.</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="accent">{pending} pending</Badge>
                  <Badge variant="success">{accepted} accepted</Badge>
                  <Badge variant="muted">{rejected} passed</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Your basket</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {bounty.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <span>{item.quantity}× {item.dishName}</span>
                  <span className="text-xs text-muted-foreground">ref. {formatCurrency(Number(item.referenceUnitPrice) * item.quantity)}</span>
                </div>
              ))}
              <div className="mt-2 border-t border-border pt-2">
                <div className="flex items-center justify-between font-semibold"><span>Budget ceiling</span><span>{formatCurrency(bounty.budget)}</span></div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Includes 3% service + ₹5 platform fee at matching time.</p>
              </div>
              {bounty.note ? (
                <p className="mt-2 rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed"><span className="font-semibold">Your note: </span>{bounty.note}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">What happens next</CardTitle></CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-4">
            {[
              { icon: Sparkles, title: "Bounty is live", body: "Eligible kitchens were notified.", done: true },
              { icon: UtensilsCrossed, title: "One kitchen accepts", body: "The claim is atomic; others are told it's gone.", done: Boolean(bounty.acceptedRestaurant) },
              { icon: ChefHat, title: "Cooking is timed", body: "The scheduler triggers based on your ETA.", done: bounty.order ? ["PREPARING", "READY", "COMPLETED"].includes(bounty.order.status) : false },
              { icon: ReceiptText, title: "Collect & drive", body: "Pick up at the counter and go.", done: bounty.order?.status === "COMPLETED" },
            ].map((step, index) => (
              <li key={step.title} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${step.done ? "bg-primary-700 text-white" : "bg-muted text-muted-foreground"}`}>
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">0{index + 1}</span>
                </div>
                <p className="mt-2 text-xs font-semibold">{step.title}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          {bounty.order ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-primary-50 px-3.5 py-3 text-xs">
              <OrderStatusBadge status={bounty.order.status} />
              <span className="font-semibold">{bounty.order.orderNumber}</span>
              <span className="text-muted-foreground">Ready {bounty.order.estimatedReadyAt ? formatDateTime(bounty.order.estimatedReadyAt) : "TBC"}</span>
              <Button asChild size="sm" variant="ghost" className="ml-auto h-7"><Link href={`/customer/orders/${bounty.order.id}`}>Track <ArrowRight /></Link></Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Bounties expire after 30 minutes without an acceptance. If every kitchen passes, you can plan again with a wider
        corridor or a different budget. No payment is collected for an unaccepted bounty.
      </p>
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
