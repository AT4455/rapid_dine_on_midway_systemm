"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  ChefHat,
  Clock3,
  Info,
  Loader2,
  Minus,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/providers/cart-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, postJson } from "@/lib/client/api";
import { estimateFees } from "@/lib/client/constants";
import type { BountyDetail, JourneyDetailResponse } from "@/lib/client/types";
import { formatCurrency, formatDistance, formatDuration, money } from "@/lib/utils";

type BountyCreateResponse = { bounty: BountyDetail; eligibleCount: number };

export default function CartPage() {
  const router = useRouter();
  const cart = useCart();
  const journey = useSWR<JourneyDetailResponse>(
    cart.journeyId ? `/api/journeys/${cart.journeyId}` : null,
    fetcher,
  );
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const fees = estimateFees(cart.subtotal);
  const recommended = money(cart.subtotal + fees);
  const minimumBudget = Math.ceil(recommended);
  const longestPrep = cart.lines.reduce((max, line) => Math.max(max, line.prepTimeMinutes), 0);
  const journeyData = journey.data?.journey;
  const journeyEnded = journeyData ? journeyData.status === "COMPLETED" || journeyData.status === "CANCELLED" : false;

  useEffect(() => {
    if (!budget && cart.lines.length) setBudget(String(minimumBudget));
    // Prefill once when the cart first has contents; the user owns the value afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.lines.length]);

  const budgetValue = Number(budget);
  const budgetValid = Number.isFinite(budgetValue) && budgetValue >= minimumBudget;
  const budgetShortfall = Math.max(0, money(minimumBudget - (Number.isFinite(budgetValue) ? budgetValue : 0)));

  const prepLabel = useMemo(() => {
    if (!cart.lines.length) return "—";
    return `${longestPrep} min`;
  }, [cart.lines.length, longestPrep]);

  async function checkout() {
    if (!cart.journeyId || !cart.restaurantId) {
      toast.error("This cart is not linked to a journey or kitchen.");
      return;
    }
    if (!budgetValid) {
      toast.error(`Increase the budget by at least ${formatCurrency(budgetShortfall)} to cover the dishes and fees.`);
      return;
    }
    setLoading(true);
    try {
      const data = await postJson<BountyCreateResponse>("/api/bounties", {
        journeyId: cart.journeyId,
        preferredRestaurantId: cart.restaurantId,
        budget: budgetValue,
        note: note.trim() || undefined,
        items: cart.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
      });
      cart.clear();
      toast.success(`Bounty sent to ${data.eligibleCount} eligible kitchen${data.eligibleCount === 1 ? "" : "s"}`, {
        description: "The first kitchen to accept creates your order.",
      });
      router.push(`/customer/bounties/${data.bounty.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the bounty.");
      setLoading(false);
    }
  }

  if (!cart.ready) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Open a journey, pick a kitchen on your corridor, and add a few dishes. You can only order from one kitchen per journey."
        action={<Button asChild><Link href="/customer/journeys">Browse journeys</Link></Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Checkout"
        title="Review your bounty"
        description="You are not paying yet. This publishes a request to eligible kitchens along your route; the first to accept creates the order."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href={cart.journeyId ? `/customer/journeys/${cart.journeyId}` : "/customer/journeys"}>
              <ArrowLeft /> Back to journey
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <p className="eyebrow">From the kitchen</p>
                <CardTitle className="mt-1">{cart.restaurantName}</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={cart.clear} className="text-red-700 hover:text-red-800">
                <Trash2 /> Clear
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {cart.lines.map((line) => (
                <div key={line.menuItemId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{line.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatCurrency(line.price)} each · {line.prepTimeMinutes} min prep</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => cart.setQuantity(line.menuItemId, line.quantity - 1)} aria-label={`Remove one ${line.name}`}>
                      <Minus />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => cart.setQuantity(line.menuItemId, line.quantity + 1)} aria-label={`Add one ${line.name}`}>
                      <Plus />
                    </Button>
                  </div>
                  <p className="w-16 text-right text-sm font-semibold">{formatCurrency(money(line.price * line.quantity))}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg"><BadgeIndianRupee className="h-4 w-4" /> Budget for this request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="budget">Your maximum budget</Label>
                  <span className="text-[11px] text-muted-foreground">Minimum {formatCurrency(minimumBudget)}</span>
                </div>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₹</span>
                  <Input
                    id="budget"
                    type="number"
                    min={minimumBudget}
                    step="1"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    className="pl-8"
                  />
                </div>
                {!budgetValid ? (
                  <p className="mt-1.5 text-[11px] text-red-700">
                    Add {formatCurrency(budgetShortfall)} more. The budget must cover the dishes plus fees.
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Kitchens compare their matched total against this. It is a ceiling, not a charge.
                  </p>
                )}
              </div>

              <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-xs">
                <Row label="Dishes subtotal" value={formatCurrency(cart.subtotal)} />
                <Row label="Service fee (3%)" value={formatCurrency(money(fees - 5))} />
                <Row label="Platform fee" value={formatCurrency(5)} />
                <div className="my-1 border-t border-border" />
                <Row label="Estimated total" value={formatCurrency(recommended)} strong />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note">Note for the kitchen <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="note"
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. Mild spice for a child, no cutlery, call when the order is ready."
                />
                <p className="text-[10px] text-muted-foreground">Never share payment details or sensitive personal information.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-primary-200 bg-primary-50/40">
            <CardHeader className="pb-3">
              <p className="eyebrow">Route</p>
              <CardTitle className="text-lg">
                {journeyData ? `${journeyData.startLabel} → ${journeyData.endLabel}` : "Loading journey…"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {journeyData ? (
                <>
                  <p className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {formatDuration(journeyData.routeDurationSeconds)} drive · {formatDistance(journeyData.corridorMeters)} corridor</p>
                  <p className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" /> Longest dish prep: {prepLabel}</p>
                  <p className="flex items-center gap-1.5"><ChefHat className="h-3.5 w-3.5" /> One kitchen accepts, then cooks to your ETA</p>
                </>
              ) : (
                <p>Waiting for route details…</p>
              )}
            </CardContent>
          </Card>

          {journeyEnded || journey.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-900">
              This journey has ended or cannot be loaded. Plan a new journey before publishing a bounty.
              {journey.error ? ` ${journey.error.message}` : ""}
            </div>
          ) : null}

          <Button size="lg" className="w-full" onClick={() => void checkout()} disabled={loading || !budgetValid || journeyEnded || !journeyData}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Publish bounty
            <ArrowRight />
          </Button>

          <div className="space-y-2 rounded-xl border border-border bg-white px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> The bounty expires in 30 minutes if no kitchen accepts. You can cancel while it is open.</p>
            <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Only verified kitchens inside your corridor, with matching dishes and available capacity, receive it.</p>
            <p className="flex items-start gap-2"><ReceiptText className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Prices are demo data. No payment method is collected or charged.</p>
          </div>

          <div className="flex justify-center gap-2">
            <Badge variant="outline">Mock payment</Badge>
            <Badge variant="outline">Expires in 30 min</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between font-semibold text-foreground" : "flex items-center justify-between"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
