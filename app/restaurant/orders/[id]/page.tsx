"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Clock3,
  Compass,
  Flame,
  Info,
  Mail,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  ReceiptText,
  ShieldAlert,
  Timer,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { RouteMap } from "@/components/map/route-map";
import { Countdown } from "@/components/shared/countdown";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { OrderStatusBadge } from "@/components/shared/status-badge";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, patchJson } from "@/lib/client/api";
import { useRoomSubscription } from "@/lib/client/socket";
import type { OrderDetailResponse } from "@/lib/client/types";
import { cn, formatCurrency, formatDateTime, formatDistance, formatDuration, timeAgo } from "@/lib/utils";

const STEPS = ["ACCEPTED", "PREPARING", "READY", "COMPLETED"];

export default function RestaurantOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error, isLoading, mutate } = useSWR<OrderDetailResponse>(`/api/orders/${id}`, fetcher, {
    refreshInterval: 8_000,
  });
  const [working, setWorking] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("Kitchen cannot prepare this order in time");
  useRoomSubscription("order", id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Order unavailable"
        description={error?.message ?? "This order does not belong to your kitchen."}
        action={<Button asChild><Link href="/restaurant/orders">Back to orders</Link></Button>}
      />
    );
  }

  const order = data.order;
  const journey = order.journey;
  const location = data.latestLocation;
  const currentStep = STEPS.indexOf(order.status);
  const live = ["ACCEPTED", "PREPARING", "READY"].includes(order.status);

  const markers = [
    ...(journey
      ? [{ id: "start", lat: Number(journey.startLatitude), lng: Number(journey.startLongitude), label: journey.startLabel, kind: "start" as const }]
      : []),
    { id: "kitchen", lat: Number(order.restaurant.latitude), lng: Number(order.restaurant.longitude), label: order.restaurant.name, meta: "Your pickup counter", kind: "restaurant" as const },
    ...(journey
      ? [{ id: "end", lat: Number(journey.endLatitude), lng: Number(journey.endLongitude), label: journey.endLabel, kind: "end" as const }]
      : []),
    ...(location
      ? [{
          id: "traveller",
          lat: Number(location.latitude),
          lng: Number(location.longitude),
          label: "Traveller",
          meta: location.source === "SIMULATED" ? "Simulated (demo)" : `Updated ${timeAgo(location.recordedAt)}`,
          kind: "driver" as const,
        }]
      : []),
  ];

  async function setStatus(status: "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED", note?: string) {
    setWorking(status);
    try {
      await patchJson(`/api/orders/${id}/status`, { status, ...(note ? { note } : {}) });
      toast.success(statusMessage(status));
      await mutate();
    } catch (statusError) {
      toast.error(statusError instanceof Error ? statusError.message : "Could not update the order.");
      await mutate();
    } finally {
      setWorking(null);
    }
  }

  async function cancelOrder() {
    if (reason.trim().length < 3) {
      toast.error("Add a short reason (at least 3 characters).");
      return;
    }
    setWorking("CANCELLED");
    try {
      await patchJson(`/api/orders/${id}/status`, { status: "CANCELLED", note: reason.trim() });
      toast.success("Order cancelled. The traveller was notified.");
      setCancelOpen(false);
      await mutate();
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : "Could not cancel the order.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Order ${order.orderNumber}`}
        title={order.customer.name}
        description={`${order.items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(", ")} · ${formatCurrency(order.total)} · ${order.prepTimeMinutes} min prep`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/restaurant/orders"><ArrowLeft /> Orders</Link></Button>
            {order.status === "ACCEPTED" ? (
              <Button size="sm" onClick={() => void setStatus("PREPARING")} disabled={Boolean(working)}>
                <Flame /> {working === "PREPARING" ? "Starting…" : "Start cooking"}
              </Button>
            ) : null}
            {order.status === "PREPARING" ? (
              <Button size="sm" onClick={() => void setStatus("READY")} disabled={Boolean(working)}>
                <PackageCheck /> {working === "READY" ? "Updating…" : "Mark ready"}
              </Button>
            ) : null}
            {order.status === "READY" ? (
              <Button size="sm" onClick={() => void setStatus("COMPLETED")} disabled={Boolean(working)}>
                <CheckCircle2 /> {working === "COMPLETED" ? "Completing…" : "Mark collected"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <Badge variant="outline"><Clock3 /> Accepted {formatDateTime(order.acceptedAt)}</Badge>
        <Badge variant="outline"><Timer /> Prep {order.prepTimeMinutes} min</Badge>
        {order.etaUpdatedAt ? <Badge variant="info">ETA updated {timeAgo(order.etaUpdatedAt)}</Badge> : null}
        {location?.source === "SIMULATED" ? <Badge variant="warning">Simulated position (demo)</Badge> : null}
        {order.cookNotifiedAt ? <Badge variant="success"><Flame /> Cook alert sent</Badge> : null}
      </div>

      {live && order.kitchenWarning ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span><span className="font-semibold">Timing warning: </span>{order.kitchenWarning}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg"><Navigation className="h-4 w-4" /> Traveller position</CardTitle>
              {location ? <span className="text-[11px] text-muted-foreground">updated {timeAgo(location.recordedAt)}</span> : null}
            </CardHeader>
            <div className="px-2 pb-2">
              <RouteMap
                route={journey?.routeGeometry}
                markers={markers}
                fitKey={journey?.id ?? order.id}
                interactive
                className="h-[280px] w-full sm:h-[340px]"
              />
            </div>
            <CardContent className="space-y-2 border-t border-border p-4 text-xs">
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{order.restaurant.address}</span>
                  <br />
                  {order.pickupInstructions}
                </span>
              </div>
              {location ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={location.source === "SIMULATED" ? "warning" : "info"}>
                    <Compass className="h-3 w-3" /> {location.source === "SIMULATED" ? "Simulated demo drive" : location.source}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {location.etaSeconds != null ? `Arrival in ${Math.max(0, Math.round(location.etaSeconds / 60))} min` : "No arrival estimate"}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  The traveller has not shared a live position yet. Their ETA comes from the journey plan.
                </p>
              )}
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Precise points are stored only for this journey, pruned after six hours, and visible only to your kitchen
                because this order is yours. To support privacy, do not copy these coordinates elsewhere.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><ReceiptText className="h-4 w-4" /> Order details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.quantity}× {item.nameSnapshot}</p>
                    <p className="text-[11px] text-muted-foreground">{formatCurrency(item.unitPrice)} each · {item.prepTimeMinutes} min prep</p>
                  </div>
                  <p className="font-semibold">{formatCurrency(item.lineTotal)}</p>
                </div>
              ))}
              <Separator />
              <div className="space-y-1 text-xs">
                <Row label="Subtotal" value={formatCurrency(order.subtotal)} />
                <Row label="Service + platform fees" value={formatCurrency(order.fees)} />
                <Row label="Traveller paid (mock)" value={formatCurrency(order.total)} strong />
              </div>
              {order.customerNote ? (
                <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
                  <span className="font-semibold">Traveller&apos;s note: </span>{order.customerNote}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-primary-200 bg-primary-50/40">
            <CardHeader className="pb-2">
              <p className="eyebrow">Next action</p>
              <CardTitle className="text-lg">
                {order.status === "ACCEPTED"
                  ? "Hold the slot, then start cooking"
                  : order.status === "PREPARING"
                    ? "Cooking in progress"
                    : order.status === "READY"
                      ? "Waiting for collection"
                      : order.status === "COMPLETED"
                        ? "Order complete"
                        : "Order closed"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.status === "ACCEPTED" ? (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The scheduler alerts you when <span className="font-semibold text-foreground">max(0, arrival − prep time)</span> arrives.
                    Starting early is allowed but risks the food sitting; starting late risks a missed pickup.
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs">
                    <Clock3 className="h-3.5 w-3.5 text-primary-700" />
                    {order.cookingStartAt ? (
                      <Countdown target={order.cookingStartAt} prefix="Planned start " />
                    ) : (
                      <span>No planned start</span>
                    )}
                  </div>
                  <Button className="w-full" onClick={() => void setStatus("PREPARING")} disabled={Boolean(working)}>
                    <Flame /> {working === "PREPARING" ? "Starting…" : "Start cooking now"}
                  </Button>
                </>
              ) : null}

              {order.status === "PREPARING" ? (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Mark ready as soon as the food is packed and waiting at the counter. The traveller gets a notification
                    and the pickup ETA stays visible on their tracking page.
                  </p>
                  <Button className="w-full" onClick={() => void setStatus("READY")} disabled={Boolean(working)}>
                    <PackageCheck /> {working === "READY" ? "Updating…" : "Mark ready for pickup"}
                  </Button>
                </>
              ) : null}

              {order.status === "READY" ? (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Hand the order over, then mark it collected. This closes the order and records completion in the
                    traveller&apos;s timeline.
                  </p>
                  <Button className="w-full" onClick={() => void setStatus("COMPLETED")} disabled={Boolean(working)}>
                    <CheckCircle2 /> {working === "COMPLETED" ? "Completing…" : "Traveller collected · complete"}
                  </Button>
                </>
              ) : null}

              {!live ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This order is {order.status.toLowerCase()}. No further kitchen action is possible. The full status
                  history below is kept for both sides.
                </p>
              ) : null}

              {live ? (
                <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full text-red-700 hover:text-red-800" disabled={Boolean(working)}>
                      <XCircle /> Cancel this order
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cancel order {order.orderNumber}</DialogTitle>
                      <DialogDescription>
                        The traveller is notified immediately with this reason. This cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                      <Label htmlFor="cancel-reason">Reason</Label>
                      <Textarea
                        id="cancel-reason"
                        value={reason}
                        maxLength={300}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="e.g. An ingredient ran out unexpectedly"
                      />
                      <p className="text-[10px] text-muted-foreground">{reason.trim().length}/300 characters</p>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={working === "CANCELLED"}>Keep order</Button>
                      <Button variant="destructive" onClick={() => void cancelOrder()} disabled={working === "CANCELLED"}>
                        {working === "CANCELLED" ? "Cancelling…" : "Cancel order"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}

              {order.bounty ? (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/restaurant/bounties/${order.bounty.id}`}>View source bounty <ArrowRight /></Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Traveller</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="flex items-center gap-2 font-semibold"><UserRound className="h-3.5 w-3.5" /> {order.customer.name}</p>
              {order.customer.phone ? (
                <a className="flex items-center gap-2 text-primary-700 hover:underline" href={`tel:${order.customer.phone}`}>
                  <Phone className="h-3.5 w-3.5" /> {order.customer.phone}
                </a>
              ) : null}
              <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {order.customer.email}</p>
              {journey ? (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {journey.startLabel} → {journey.endLabel}
                </p>
              ) : null}
              <p className="flex items-start gap-2 text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Contact details are shown only for an active order. Do not reuse them for marketing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Status timeline</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-1">
                {STEPS.map((step, index) => {
                  const history = order.statusHistory.find((entry) => entry.toStatus === step);
                  const done = currentStep >= index && currentStep !== -1;
                  const active = currentStep === index;
                  return (
                    <li key={step} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={cn("timeline-dot", done ? "border-primary-700 bg-primary-700 text-white" : "border-border text-muted-foreground")}>
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                        </span>
                        {index < STEPS.length - 1 ? <span className={cn("my-0.5 h-7 w-px", done ? "bg-primary-300" : "bg-border")} /> : null}
                      </div>
                      <div className="pb-2">
                        <p className={cn("text-sm font-semibold", active && "text-primary-800")}>{stepLabel(step)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {history ? `${formatDateTime(history.createdAt)} · ${history.actorRole.toLowerCase()}` : done ? "Completed" : "Pending"}
                          {history?.note ? ` · ${history.note}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {["CANCELLED", "REJECTED"].includes(order.status) ? (
                <div className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-800">
                  {order.statusHistory.at(-1)?.note ?? `Order ${order.status.toLowerCase()}.`}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {journey ? (
            <Card>
              <CardContent className="grid grid-cols-2 gap-3 p-4">
                <MiniMetric label="Journey drive" value={formatDuration(journey.routeDurationSeconds)} />
                <MiniMetric label="Corridor" value={formatDistance(journey.corridorMeters)} />
                <MiniMetric label="Bounty ETA" value={`${order.bounty.pickupEtaMinutes} min`} />
                <MiniMetric label="Order ready by" value={order.estimatedReadyAt ? formatDateTime(order.estimatedReadyAt) : "TBC"} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ChefHat className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Payments are mocked for this hackathon build. The traveller pays nothing and your kitchen receives no settlement;
        totals are recorded only so the bounty budget and fee maths stay consistent.
      </p>
    </div>
  );
}

function stepLabel(status: string) {
  if (status === "ACCEPTED") return "Order accepted";
  if (status === "PREPARING") return "Cooking";
  if (status === "READY") return "Ready for pickup";
  return "Collected";
}

function statusMessage(status: string) {
  if (status === "PREPARING") return "Cooking started. The traveller can see the change.";
  if (status === "READY") return "Marked ready. The traveller was notified for pickup.";
  if (status === "COMPLETED") return "Order completed.";
  if (status === "ACCEPTED") return "Order accepted.";
  return "Order updated.";
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between font-semibold text-foreground" : "flex items-center justify-between text-muted-foreground"}>
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}
