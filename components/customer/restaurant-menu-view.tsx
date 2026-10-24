"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Leaf,
  MapPin,
  Minus,
  Navigation,
  Plus,
  ShoppingBag,
  Star,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { KitchenBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/components/providers/cart-provider";
import { fetcher } from "@/lib/client/api";
import { DIETARY_LABELS, ALLERGEN_LABELS } from "@/lib/client/constants";
import type { RestaurantMenuPayload } from "@/lib/client/types";
import { cn, formatCurrency, formatDistance } from "@/lib/utils";

type Filter = "ALL" | "VEGETARIAN" | "VEGAN" | "GLUTEN_FREE";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "Everything" },
  { value: "VEGETARIAN", label: "Vegetarian" },
  { value: "VEGAN", label: "Vegan" },
  { value: "GLUTEN_FREE", label: "Gluten free" },
];

export function RestaurantMenuView({
  restaurantId,
  journeyId,
}: {
  restaurantId: string;
  journeyId: string | null;
}) {
  const url = `/api/customer/restaurants/${restaurantId}${journeyId ? `?journeyId=${encodeURIComponent(journeyId)}` : ""}`;
  const { data, error, isLoading } = useSWR<RestaurantMenuPayload>(url, fetcher);
  const [filter, setFilter] = useState<Filter>("ALL");
  const cart = useCart();

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ category: string; items: RestaurantMenuPayload["menu"] }>;
    const visible = data.menu.filter(
      (item) => filter === "ALL" || item.dietaryTags.includes(filter),
    );
    const map = new Map<string, RestaurantMenuPayload["menu"]>();
    for (const item of visible) {
      map.set(item.category, [...(map.get(item.category) ?? []), item]);
    }
    return [...map.entries()].map(([category, items]) => ({ category, items }));
  }, [data, filter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Kitchen unavailable"
        description={error?.message ?? "This restaurant could not be loaded."}
        action={<Button asChild><Link href="/customer/journeys">Back to journeys</Link></Button>}
      />
    );
  }

  const restaurant = data.restaurant;
  const canOrder = restaurant.openNow && Boolean(journeyId);
  const cartMatches = cart.restaurantId === restaurant.id && cart.journeyId === journeyId;

  function add(item: RestaurantMenuPayload["menu"][number]) {
    if (!canOrder) return;
    const result = cart.addItem(
      {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        prepTimeMinutes: item.prepTimeMinutes,
        dietaryTags: item.dietaryTags,
        imageUrl: item.imageUrl,
      },
      { id: restaurant.id, name: restaurant.name },
      journeyId,
    );
    if (result.replaced) {
      toast.message(`Cart switched to ${restaurant.name}`, {
        description: "A cart can only contain dishes from one kitchen per journey.",
      });
    } else {
      toast.success(`${item.name} added`, { duration: 1200 });
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Button asChild variant="ghost" size="sm">
          <Link href={journeyId ? `/customer/journeys/${journeyId}` : "/customer/journeys"}>
            <ArrowLeft /> {journeyId ? "Back to journey" : "Journeys"}
          </Link>
        </Button>
        {data.journey ? (
          <span className="inline-flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5" /> {data.journey.startLabel} → {data.journey.endLabel}
          </span>
        ) : (
          <Badge variant="warning">No journey attached — browsing only</Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{restaurant.name}</h1>
                <KitchenBadge open={restaurant.openNow} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{restaurant.cuisine}</span>
                <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> {restaurant.rating.toFixed(1)} ({restaurant.ratingCount} ratings)</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {restaurant.openingTime}–{restaurant.closingTime}</span>
                <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {restaurant.activeOrders}/{restaurant.capacityPerHour} slots used</span>
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{restaurant.description}</p>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {restaurant.address}
              </p>
            </div>

            {data.corridorMatch ? (
              <div className="shrink-0 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 sm:w-56">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary-700">On your route</p>
                <p className="mt-1 font-display text-2xl font-semibold">~{data.corridorMatch.etaMinutes} min</p>
                <p className="text-[11px] text-muted-foreground">estimated arrival from journey start</p>
                <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  <p>{formatDistance(data.corridorMatch.detourMeters)} detour</p>
                  <p>{formatDistance(data.corridorMatch.distanceFromRouteMeters)} from the road</p>
                  <p>{formatDistance(data.journey?.corridorMeters ?? 0)} corridor</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-border bg-muted/50 px-4 py-3 text-xs leading-relaxed">
            <span className="font-semibold">Pickup: </span>{restaurant.pickupInstructions}
          </div>
        </CardContent>
      </Card>

      {!canOrder ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          {!restaurant.openNow
            ? "This kitchen is closed right now. You can browse the menu, but ordering is disabled until it reopens."
            : "Open this kitchen from a journey to order ahead. A journey gives us the route and arrival time needed for a bounty."}
          {!journeyId ? (
            <Link href="/customer/journeys/new" className="ml-1 font-semibold underline">Plan a journey</Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === option.value
                ? "border-primary-700 bg-primary-700 text-white"
                : "border-border bg-white text-muted-foreground hover:border-primary-200 hover:text-foreground",
            )}
          >
            {option.value === "VEGETARIAN" || option.value === "VEGAN" ? <Leaf className="h-3.5 w-3.5" /> : null}
            {option.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">{grouped.reduce((sum, group) => sum + group.items.length, 0)} dishes</span>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No dishes match that filter"
          description="Try 'Everything', or check the dietary tags on each dish. Kitchens set these tags themselves."
          action={<Button variant="outline" onClick={() => setFilter("ALL")}>Show everything</Button>}
        />
      ) : (
        <div className="space-y-7">
          {grouped.map((group) => (
            <section key={group.category}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold">{group.category}</h2>
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => {
                  const line = cartMatches ? cart.lines.find((entry) => entry.menuItemId === item.id) : undefined;
                  return (
                    <Card key={item.id} className={cn("transition-colors", !item.isAvailable && "opacity-70")}>
                      <CardContent className="flex h-full flex-col p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold leading-snug">{item.name}</p>
                            {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p> : null}
                          </div>
                          <p className="shrink-0 font-display text-lg font-semibold">{formatCurrency(item.price)}</p>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.dietaryTags.map((tag) => (
                            <Badge key={tag} variant={tag === "VEGAN" || tag === "VEGETARIAN" ? "success" : "secondary"} className="text-[10px]">
                              {DIETARY_LABELS[tag] ?? tag}
                            </Badge>
                          ))}
                          {item.allergens.map((allergen) => (
                            <Badge key={allergen} variant="warning" className="text-[10px]">
                              {ALLERGEN_LABELS[allergen] ?? allergen}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Timer className="h-3.5 w-3.5" /> {item.prepTimeMinutes} min prep</span>
                          {!item.isAvailable ? (
                            <Badge variant="muted">Sold out</Badge>
                          ) : line ? (
                            <div className="flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 p-0.5">
                              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => cart.setQuantity(item.id, line.quantity - 1)} aria-label={`Remove one ${item.name}`}>
                                <Minus />
                              </Button>
                              <span className="w-5 text-center text-xs font-bold tabular-nums">{line.quantity}</span>
                              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => cart.setQuantity(item.id, line.quantity + 1)} aria-label={`Add one ${item.name}`}>
                                <Plus />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" onClick={() => add(item)} disabled={!canOrder} title={!canOrder ? "Open from a journey while the kitchen is open" : undefined}>
                              <Plus /> Add
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Allergen tags are declared by the kitchen. Shared equipment means cross-contamination is possible; Rapid Dine
        cannot guarantee allergen-free food. Prices are in INR; checkout adds a 3% service fee + ₹5 platform fee.
      </p>

      {cart.count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
          <div className="container-wide flex items-center gap-3 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-100 text-primary-800">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {cart.count} item{cart.count === 1 ? "" : "s"} · {formatCurrency(cart.subtotal)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{cart.restaurantName}</p>
            </div>
            <Button asChild>
              <Link href="/customer/cart">Review & checkout <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
