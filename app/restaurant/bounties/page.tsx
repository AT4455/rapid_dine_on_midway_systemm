"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowRight,
  ChefHat,
  Clock3,
  MapPin,
  Route,
  Sparkles,
  Timer,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Countdown } from "@/components/shared/countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, postJson } from "@/lib/client/api";
import type { RestaurantBountyOffer } from "@/lib/client/types";
import { formatCurrency, formatDateTime, formatDistance, formatDuration } from "@/lib/utils";

export default function RestaurantBountiesPage() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<{ offers: RestaurantBountyOffer[] }>(
    "/api/bounties",
    fetcher,
    { refreshInterval: 10_000 },
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RestaurantBountyOffer | null>(null);
  const [rejectReason, setRejectReason] = useState("Kitchen is fully booked for that arrival time");
  const offers = data?.offers ?? [];

  async function accept(offer: RestaurantBountyOffer) {
    if (!window.confirm("Accept this bounty? The order is created immediately and the traveller is notified.")) return;
    setBusy(offer.bountyId);
    try {
      const result = await postJson<{ order: { id: string; orderNumber: string } }>(
        `/api/bounties/${offer.bountyId}/accept`,
      );
      toast.success(`Order ${result.order.orderNumber} created.`);
      router.push(`/restaurant/orders/${result.order.id}`);
    } catch (acceptError) {
      toast.error(acceptError instanceof Error ? acceptError.message : "Could not accept the bounty.");
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error("Add a short reason (at least 3 characters).");
      return;
    }
    const offer = rejectTarget;
    setBusy(offer.bountyId);
    try {
      await postJson(`/api/bounties/${offer.bountyId}/reject`, { reason });
      toast.success("Bounty passed. It stays open for other kitchens.");
      setRejectTarget(null);
      await mutate();
    } catch (rejectError) {
      toast.error(rejectError instanceof Error ? rejectError.message : "Could not pass on the bounty.");
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Bounties for your kitchen"
        description="A bounty is a budgeted food request from a traveller passing your corridor. Only one kitchen can accept, and acceptance re-validates your menu, hours, capacity and the budget."
        action={<Button asChild variant="outline"><Link href="/restaurant/dashboard">Dashboard <ArrowRight /></Link></Button>}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline"><Sparkles /> {isLoading ? "Loading offers…" : `${offers.length} open offer${offers.length === 1 ? "" : "s"}`}</Badge>
        <span>Offers vanish the moment another kitchen wins or the traveller&apos;s 30-minute window closes.</span>
      </div>

      {error ? (
        <Card><CardContent className="p-6 text-sm text-red-700">Could not load bounties. {error.message}</CardContent></Card>
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}</div>
      ) : offers.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No bounties waiting"
          description="You receive a bounty only when every requested dish is on your menu, you are inside the traveller's corridor, you are open with capacity, and the budget covers your prices plus fees."
          action={<Button asChild><Link href="/restaurant/kitchen"><ChefHat /> Check the kitchen</Link></Button>}
        />
      ) : (
        <div className="grid gap-3.5">
          {offers.map((offer) => {
            const bounty = offer.bounty;
            const journey = bounty.journey;
            const isBusy = busy === offer.bountyId;
            return (
              <Card key={offer.id} className={offer.isPreferred ? "border-orange-200 bg-orange-50/20" : undefined}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {offer.isPreferred ? <Badge variant="accent">Preferred by the traveller</Badge> : <Badge variant="outline">Route match</Badge>}
                        <Badge variant="warning"><Countdown target={bounty.expiresAt} prefix="Expires in " /></Badge>
                        <span className="text-[11px] text-muted-foreground">Offered {formatDateTime(offer.createdAt)}</span>
                      </div>

                      <h2 className="mt-2 font-display text-lg font-semibold">
                        {bounty.items.map((item) => `${item.quantity}× ${item.dishName}`).join(", ")}
                      </h2>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {journey.startLabel} → {journey.endLabel}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> arrival ~{bounty.pickupEtaMinutes} min</span>
                        <span className="inline-flex items-center gap-1"><Route className="h-3.5 w-3.5" /> {formatDistance(offer.detourMeters)} detour</span>
                        <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {formatDuration(journey.routeDurationSeconds)} drive so far</span>
                      </div>

                      {bounty.note ? (
                        <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed">
                          <span className="font-semibold">Traveller&apos;s note: </span>{bounty.note}
                        </p>
                      ) : null}

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <OfferMetric label="Traveller budget" value={formatCurrency(bounty.budget)} />
                        <OfferMetric label="Your matched total" value={offer.matchedTotal != null ? formatCurrency(offer.matchedTotal) : "Re-check on accept"} />
                        <OfferMetric label="Distance from route" value={formatDistance(offer.distanceFromRouteMeters)} />
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 lg:w-44">
                      <Button onClick={() => void accept(offer)} disabled={isBusy}>
                        <UtensilsCrossed /> {isBusy ? "Working…" : "Accept bounty"}
                      </Button>
                      <Button asChild variant="outline">
                        <Link href={`/restaurant/bounties/${offer.bountyId}`}>Review details <ArrowRight /></Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-red-700 hover:text-red-800"
                        onClick={() => {
                          setRejectReason("Kitchen is fully booked for that arrival time");
                          setRejectTarget(offer);
                        }}
                        disabled={isBusy}
                      >
                        <XCircle /> Pass with a reason
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Accepting is concurrency-safe: the server flips the bounty from OPEN to ACCEPTED in one conditional transaction.
        If another kitchen wins first, your request returns a conflict and the offer disappears. Your prices still need to
        fit the traveller&apos;s budget including the 3% service fee and ₹5 platform fee.
      </p>

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRejectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pass on this bounty?</DialogTitle>
            <DialogDescription>
              It stays open for other kitchens. The traveller sees your reason, so keep it short and specific.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              maxLength={240}
              placeholder="Kitchen is fully booked for that arrival time"
            />
            <p className="text-[11px] text-muted-foreground">At least 3 characters. {rejectReason.trim().length}/240</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectTarget(null)} disabled={busy !== null}>Keep offer</Button>
            <Button
              variant="destructive"
              onClick={() => void reject()}
              disabled={busy !== null || rejectReason.trim().length < 3}
            >
              {busy ? "Passing…" : "Pass bounty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-white/70 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}
