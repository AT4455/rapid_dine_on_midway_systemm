"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  CheckCircle2,
  ChefHat,
  Clock3,
  Compass,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Play,
  ReceiptText,
  ShieldAlert,
  Square,
  Timer,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { RouteMap } from "@/components/map/route-map";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { Countdown } from "@/components/shared/countdown";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, fetcher, patchJson, postJson } from "@/lib/client/api";
import { useRoomSubscription } from "@/lib/client/socket";
import type { OrderDetailResponse } from "@/lib/client/types";
import { cn, formatCurrency, formatDateTime, formatDistance, formatDuration, timeAgo } from "@/lib/utils";

const STEPS = ["ACCEPTED", "PREPARING", "READY", "COMPLETED"];

export default function CustomerOrderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error, isLoading, mutate } = useSWR<OrderDetailResponse>(`/api/orders/${id}`, fetcher, {
    refreshInterval: 10_000,
  });
  const [simulating, setSimulating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("Change of travel plans");
  const simIndex = useRef(0);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useRoomSubscription("order", id);

  useEffect(() => {
    return () => {
      if (simTimer.current) clearInterval(simTimer.current);
    };
  }, []);

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
        description={error?.message ?? "This order could not be loaded."}
        action={<Button asChild><Link href="/customer/orders">Back to orders</Link></Button>}
      />
    );
  }

  const order = data.order;
  const journey = order.journey;
  const location = data.latestLocation;
  const canTrack = data.side === "customer" && ["ACCEPTED", "PREPARING", "READY"].includes(order.status);
  const canCancel = data.side === "customer" && ["ACCEPTED", "PREPARING"].includes(order.status);
  const currentStep = STEPS.indexOf(order.status);

  const markers = journey
    ? [
        { id: "start", lat: Number(journey.startLatitude), lng: Number(journey.startLongitude), label: journey.startLabel, kind: "start" as const },
        { id: "kitchen", lat: Number(order.restaurant.latitude), lng: Number(order.restaurant.longitude), label: order.restaurant.name, meta: "Pickup counter", kind: "restaurant" as const },
        { id: "end", lat: Number(journey.endLatitude), lng: Number(journey.endLongitude), label: journey.endLabel, kind: "end" as const },
        ...(location
          ? [{ id: "driver", lat: Number(location.latitude), lng: Number(location.longitude), label: "Your last shared position", meta: location.source === "SIMULATED" ? "Simulated (demo)" : location.source, kind: "driver" as const }]
          : []),
      ]
    : [{ id: "kitchen", lat: Number(order.restaurant.latitude), lng: Number(order.restaurant.longitude), label: order.restaurant.name, kind: "restaurant" as const }];

  async function shareActualLocation() {
    if (!navigator.geolocation) {
      toast.error("This browser does not expose geolocation.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await postJson(`/api/orders/${id}/location`, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            source: "GPS",
          });
          toast.success("Location shared with the kitchen.");
          await mutate();
        } catch (shareError) {
          toast.error(shareError instanceof Error ? shareError.message : "Could not share location.");
        } finally {
          setLocating(false);
        }
      },
      (geoError) => {
        toast.error(geoError.message || "Location permission was denied.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  function toggleSimulation() {
    if (simulating) {
      if (simTimer.current) clearInterval(simTimer.current);
      simTimer.current = null;
      setSimulating(false);
      toast.message("Simulation stopped.");
      return;
    }
    const route = journey?.routeGeometry ?? [];
    if (route.length < 2) {
      toast.error("This order has no journey route to simulate along.");
      return;
    }
    setSimulating(true);
    toast.message("Simulated drive started", {
      description: "Labelled demo data is sent as SIMULATED location. Stop any time.",
    });
    const stride = Math.max(1, Math.floor(route.length / 18));
    simTimer.current = setInterval(async () => {
      simIndex.current = Math.min(route.length - 1, simIndex.current + stride);
      const [lng, lat] = route[simIndex.current];
      try {
        await postJson(`/api/orders/${id}/location`, {
          latitude: lat,
          longitude: lng,
          source: "SIMULATED",
          accuracyMeters: 25,
        });
        await mutate();
      } catch {
        /* rate limits or an ended journey stop the loop quietly */
      }
      if (simIndex.current >= route.length - 1) {
        if (simTimer.current) clearInterval(simTimer.current);
        simTimer.current = null;
        setSimulating(false);
        toast.message("Simulated arrival reached.");
      }
    }, 5000);
  }

  async function cancelOrder() {
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast.error("Add a short reason (at least 3 characters).");
      return;
    }
    setCancelling(true);
    try {
      await patchJson(`/api/orders/${id}/status`, { status: "CANCELLED", note: reason });
      toast.success("Order cancelled.");
      setCancelOpen(false);
      await mutate();
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : "Could not cancel the order.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Order ${order.orderNumber}`}
        title={order.restaurant.name}
        description={`${order.items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(", ")} · ${formatCurrency(order.total)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/customer/orders"><ArrowLeft /> Orders</Link></Button>
            {canCancel ? (
              <Button variant="outline" size="sm" className="text-red-700" onClick={() => setCancelOpen(true)} disabled={cancelling}>
                <XCircle /> {cancelling ? "Cancelling…" : "Cancel order"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <Badge variant="outline"><Clock3 /> Placed {formatDateTime(order.createdAt)}</Badge>
        <Badge variant="outline"><Timer /> Prep {order.prepTimeMinutes} min</Badge>
        {canTrack && order.etaUpdatedAt ? <Badge variant="info">ETA updated {timeAgo(order.etaUpdatedAt)}</Badge> : null}
        {location?.source === "SIMULATED" ? <Badge variant="warning">Simulated location (demo)</Badge> : null}
      </div>

      {canTrack && order.kitchenWarning ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span><span className="font-semibold">Kitchen note: </span>{order.kitchenWarning}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg"><Navigation className="h-4 w-4" /> {canTrack ? "Live pickup map" : "Pickup map"}</CardTitle>
              {location ? <span className="text-[11px] text-muted-foreground">updated {timeAgo(location.recordedAt)}</span> : null}
            </CardHeader>
            <div className="px-2 pb-2">
              {journey ? (
                <RouteMap
                  route={journey.routeGeometry}
                  markers={markers}
                  fitKey={journey.id}
                  interactive
                  className="h-[280px] w-full sm:h-[340px]"
                />
              ) : (
                <RouteMap markers={markers} fitKey={order.id} interactive className="h-[240px] w-full" />
              )}
            </div>
            <CardContent className="space-y-3 border-t border-border p-4">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{order.restaurant.address}</span>
                  <br />
                  {order.pickupInstructions}
                </span>
              </div>

              {canTrack ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void shareActualLocation()} disabled={locating}>
                    {locating ? <Loader2 className="animate-spin" /> : <Compass />}
                    Share my location
                  </Button>
                  <Button size="sm" variant={simulating ? "destructive" : "secondary"} onClick={toggleSimulation}>
                    {simulating ? <Square /> : <Play />}
                    {simulating ? "Stop demo drive" : "Simulate drive (demo)"}
                  </Button>
                  <Badge variant="warning">Simulation is labelled demo data</Badge>
                </div>
              ) : null}

              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Precise points are stored only for this journey, pruned after six hours, and shown to this kitchen only
                because it won your order. Ending the journey deletes them immediately.
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
                <Row label="Total (mock payment)" value={formatCurrency(order.total)} strong />
              </div>
              {order.customerNote ? (
                <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed"><span className="font-semibold">Your note: </span>{order.customerNote}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-primary-200 bg-primary-50/40">
            <CardHeader className="pb-2">
              <p className="eyebrow">Pickup</p>
              <CardTitle className="text-lg">
                {order.status === "READY" ? "Ready at the counter" : order.status === "COMPLETED" ? "Completed" : "Estimated ready"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-display text-3xl font-semibold">
                {order.estimatedReadyAt ? formatDateTime(order.estimatedReadyAt) : "TBC"}
              </p>
              {order.estimatedReadyAt && ["ACCEPTED", "PREPARING"].includes(order.status) ? (
                <Countdown target={order.estimatedReadyAt} prefix="in " className="text-sm text-primary-800" />
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link href={`/customer/bounties/${order.bounty.id}`}>View bounty</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={`tel:${order.restaurant.phone}`}><Phone /> Call</a>
                </Button>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                ETA is an estimate. Traffic, kitchen load and your updates can move it.
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

          <Card>
            <CardContent className="space-y-2 p-4 text-[11px] leading-relaxed text-muted-foreground">
              <p className="flex items-start gap-2"><ChefHat className="mt-0.5 h-3.5 w-3.5 shrink-0" /> The kitchen starts cooking at a time computed from your ETA minus prep time.</p>
              <p className="flex items-start gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Payments are mocked for this hackathon build. No card was charged.</p>
              {location && data.distanceToKitchenMeters != null ? (
                <p className="flex items-start gap-2"><Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Distance to kitchen: {formatDistance(data.distanceToKitchenMeters)} as the crow flies</p>
              ) : canTrack ? (
                <p className="flex items-start gap-2"><Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Share your location to see your distance to the kitchen.</p>
              ) : journey ? (
                <p className="flex items-start gap-2"><Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Journey distance {formatDistance(journey.routeDistanceMeters)}</p>
              ) : null}
              {journey ? <p className="flex items-start gap-2"><Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Journey drive time {formatDuration(journey.routeDurationSeconds)}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={(open) => { if (!cancelling) setCancelOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              The kitchen is notified immediately and this can&apos;t be undone. Your reason is shared with the kitchen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={3}
              maxLength={240}
              placeholder="Change of travel plans"
            />
            <p className="text-[11px] text-muted-foreground">At least 3 characters. {cancelReason.trim().length}/240</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>Keep order</Button>
            <Button variant="destructive" onClick={() => void cancelOrder()} disabled={cancelling || cancelReason.trim().length < 3}>
              {cancelling ? <Loader2 className="animate-spin" /> : <XCircle />} {cancelling ? "Cancelling…" : "Cancel order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function stepLabel(status: string) {
  if (status === "ACCEPTED") return "Order accepted";
  if (status === "PREPARING") return "Cooking now";
  if (status === "READY") return "Ready for pickup";
  return "Completed";
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between font-semibold text-foreground" : "flex items-center justify-between text-muted-foreground"}>
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
