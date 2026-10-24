"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Clock3,
  MapPin,
  ReceiptText,
  Route,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { RouteMap } from "@/components/map/route-map";
import { Countdown } from "@/components/shared/countdown";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { BountyStatusBadge, OrderStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, postJson } from "@/lib/client/api";
import { useRoomSubscription } from "@/lib/client/socket";
import type { BountyDetail } from "@/lib/client/types";
import { formatCurrency, formatDateTime, formatDistance, formatDuration } from "@/lib/utils";

type BountyResponse = {
  bounty: BountyDetail;
  viewer: "restaurant";
  offerStatus: string;
  acceptedByYou: boolean;
};

export default function RestaurantBountyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data, error, isLoading, mutate } = useSWR<BountyResponse>(`/api/bounties/${id}`, fetcher, {
    refreshInterval: 10_000,
  });
  const [accepting, setAccepting] = useState(false);
  const [reason, setReason] = useState("Kitchen is fully booked for that arrival time");
  const [rejecting, setRejecting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  useRoomSubscription("bounty", id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Bounty unavailable"
        description={error?.message ?? "This bounty was not offered to your kitchen, or it is no longer open."}
        action={<Button asChild><Link href="/restaurant/bounties">Back to bounties</Link></Button>}
      />
    );
  }

  const { bounty, offerStatus, acceptedByYou } = data;
  const journey = bounty.journey;
  const canRespond = bounty.status === "OPEN" && offerStatus === "PENDING";
  const pendingOffers = bounty.offers.filter((offer) => offer.status === "PENDING").length;

  const markers = [
    { id: "start", lat: Number(journey.startLatitude), lng: Number(journey.startLongitude), label: journey.startLabel, kind: "start" as const },
    { id: "end", lat: Number(journey.endLatitude), lng: Number(journey.endLongitude), label: journey.endLabel, kind: "end" as const },
  ];

  async function accept() {
    if (!window.confirm("Accept this bounty? An order is created immediately for the traveller.")) return;
    setAccepting(true);
    try {
      const result = await postJson<{ order: { id: string; orderNumber: string } }>(`/api/bounties/${id}/accept`);
      toast.success(`Order ${result.order.orderNumber} created.`);
      router.push(`/restaurant/orders/${result.order.id}`);
    } catch (acceptError) {
      toast.error(acceptError instanceof Error ? acceptError.message : "Could not accept the bounty.");
      await mutate();
    } finally {
      setAccepting(false);
    }
  }

  async function reject() {
    if (reason.trim().length < 3) {
      toast.error("Add a short reason (at least 3 characters).");
      return;
    }
    setRejecting(true);
    try {
      await postJson(`/api/bounties/${id}/reject`, { reason: reason.trim() });
      toast.success("Bounty passed. Other kitchens can still accept.");
      setRejectOpen(false);
      await mutate();
    } catch (rejectError) {
      toast.error(rejectError instanceof Error ? rejectError.message : "Could not pass on the bounty.");
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Bounty · ${offerStatus.toLowerCase()}`}
        title={bounty.items.map((item) => `${item.quantity}× ${item.dishName}`).join(", ")}
        description={`${journey.startLabel} → ${journey.endLabel} · budget ${formatCurrency(bounty.budget)} · arrival in about ${bounty.pickupEtaMinutes} min`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/restaurant/bounties"><ArrowLeft /> Bounties</Link></Button>
            {acceptedByYou && bounty.order ? (
              <Button asChild size="sm"><Link href={`/restaurant/orders/${bounty.order.id}`}><ReceiptText /> Manage order</Link></Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <BountyStatusBadge status={bounty.status} />
        {bounty.status === "OPEN" ? (
          <Badge variant="warning"><Countdown target={bounty.expiresAt} prefix="Expires in " /></Badge>
        ) : null}
        {bounty.offers.some((offer) => offer.isPreferred) && bounty.preferredRestaurant ? (
          <Badge variant="accent">Traveller preferred {bounty.preferredRestaurant.name}</Badge>
        ) : null}
        <Badge variant="outline"><UserRound /> {bounty.customer.name}</Badge>
        <Badge variant="outline"><Clock3 /> Created {formatDateTime(bounty.createdAt)}</Badge>
        {pendingOffers > 0 && bounty.status === "OPEN" ? <Badge variant="info">{pendingOffers} kitchen{pendingOffers === 1 ? "" : "s"} still deciding</Badge> : null}
        {acceptedByYou ? <Badge variant="success"><ShieldCheck /> You won this order</Badge> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-2">
            <RouteMap
              route={journey.routeGeometry}
              markers={markers}
              fitKey={journey.id}
              interactive
              className="h-[280px] w-full"
            />
          </div>
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <Metric label="Corridor" value={formatDistance(journey.corridorMeters)} />
            <Metric label="Drive total" value={formatDuration(journey.routeDurationSeconds)} />
            <Metric label="Arrival ETA" value={`${bounty.pickupEtaMinutes} min`} />
            <Metric label="Dishes" value={`${bounty.items.reduce((sum, item) => sum + item.quantity, 0)} items`} />
          </CardContent>
          <CardContent className="border-t border-border p-4 text-[11px] leading-relaxed text-muted-foreground">
            The route is shown so you can judge the detour. The traveller&apos;s precise live position is withheld until
            you accept; after that the order page shows their latest shared position.
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={canRespond ? "border-orange-200 bg-orange-50/30" : undefined}>
            <CardHeader className="pb-2">
              <p className="eyebrow">{canRespond ? "Your decision" : "Offer closed"}</p>
              <CardTitle className="text-lg">
                {canRespond ? "Accept before another kitchen does" : offerStatus === "REJECTED" ? "You passed on this bounty" : "This offer is no longer open"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canRespond ? (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Acceptance re-checks that every dish is available, your kitchen is open, capacity remains and the
                    traveller&apos;s budget still covers your prices plus the 3% service fee and ₹5 platform fee. If any
                    check fails, nothing is created and the offer is withdrawn.
                  </p>
                  <Button className="w-full" onClick={() => void accept()} disabled={accepting || rejecting}>
                    <UtensilsCrossed /> {accepting ? "Accepting…" : "Accept & create order"}
                  </Button>
                  <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full text-red-700" disabled={accepting || rejecting}>
                        <XCircle /> Pass with a reason
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Pass on this bounty</DialogTitle>
                        <DialogDescription>
                          The traveller sees a short reason. The bounty stays open for other eligible kitchens until it
                          expires.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-1.5">
                        <Label htmlFor="reject-reason">Reason</Label>
                        <Textarea
                          id="reject-reason"
                          value={reason}
                          maxLength={200}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="e.g. No capacity for that arrival time"
                        />
                        <p className="text-[10px] text-muted-foreground">{reason.trim().length}/200 characters</p>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={rejecting}>Keep offer</Button>
                        <Button variant="destructive" onClick={() => void reject()} disabled={rejecting}>
                          {rejecting ? "Passing…" : "Confirm pass"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              ) : acceptedByYou && bounty.order ? (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Order {bounty.order.orderNumber} was created from this bounty. Start cooking at the planned time and
                    mark each status as you go.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs">
                    <OrderStatusBadge status={bounty.order.status} />
                    <span className="text-muted-foreground">Ready {bounty.order.estimatedReadyAt ? formatDateTime(bounty.order.estimatedReadyAt) : "TBC"}</span>
                  </div>
                  <Button asChild className="w-full"><Link href={`/restaurant/orders/${bounty.order.id}`}>Open order <ArrowRight /></Link></Button>
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {bounty.status === "ACCEPTED"
                      ? `${bounty.acceptedRestaurant?.name ?? "Another kitchen"} accepted first. Acceptance is atomic, so only one order can exist.`
                      : bounty.status === "EXPIRED"
                        ? "The 30-minute response window closed before any kitchen accepted."
                        : bounty.status === "CANCELLED"
                          ? "The traveller cancelled this request."
                          : bounty.status === "REJECTED"
                            ? "Every eligible kitchen passed on this request."
                            : "This offer is no longer actionable."}
                  </p>
                  <Button asChild variant="outline" className="w-full"><Link href="/restaurant/bounties">Browse open bounties</Link></Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Requested basket</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {bounty.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <span>{item.quantity}× {item.dishName}</span>
                  <span className="text-xs text-muted-foreground">ref. {formatCurrency(Number(item.referenceUnitPrice) * item.quantity)}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold">
                <span>Budget ceiling</span>
                <span>{formatCurrency(bounty.budget)}</span>
              </div>
              {bounty.note ? (
                <p className="mt-2 rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed">
                  <span className="font-semibold">Traveller&apos;s note: </span>{bounty.note}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">How this offer reached you</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {[
            { icon: Route, title: "On the route", body: "Your kitchen sits inside the traveller's corridor buffer." },
            { icon: ChefHat, title: "Menu match", body: "Every requested dish exists on your live menu." },
            { icon: Timer, title: "Timing works", body: "You are open and can prep before the traveller arrives." },
            { icon: Sparkles, title: "Budget fits", body: "Your matched total stays within the traveller's budget." },
          ].map((step) => (
            <div key={step.title} className="rounded-xl border border-border p-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-primary-700">
                <step.icon className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xs font-semibold">{step.title}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Route matching uses a buffered polyline approximation with Turf.js. Detour is estimated as twice the
        perpendicular distance from the route, which is accurate enough for this demo but not a live traffic model.
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
