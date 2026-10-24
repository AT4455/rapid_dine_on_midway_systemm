"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  CheckCircle2,
  Leaf,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, fetcher, patchJson, postJson } from "@/lib/client/api";
import { ALLERGEN_LABELS, DIETARY_LABELS } from "@/lib/client/constants";
import type { RestaurantMenuItem } from "@/lib/client/types";
import { cn, formatCurrency } from "@/lib/utils";

type Editor = { mode: "create" } | { mode: "edit"; item: RestaurantMenuItem } | null;

export default function RestaurantMenuPage() {
  const { data, error, isLoading, mutate } = useSWR<{ items: RestaurantMenuItem[] }>(
    "/api/restaurant/menu",
    fetcher,
  );
  const [editor, setEditor] = useState<Editor>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [toggling, setToggling] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const items = data?.items ?? [];

  const categories = useMemo(() => [...new Set(items.map((item) => item.category))].sort(), [items]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const matchesQuery = !query || item.name.toLowerCase().includes(query) || (item.description ?? "").toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [category, items, search]);

  async function toggleAvailability(item: RestaurantMenuItem) {
    setToggling(item.id);
    try {
      await patchJson(`/api/restaurant/menu/${item.id}`, { isAvailable: !item.isAvailable });
      toast.success(`${item.name} is now ${item.isAvailable ? "unavailable" : "available"}.`);
      await mutate();
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : "Could not update availability.");
    } finally {
      setToggling(null);
    }
  }

  async function archive(item: RestaurantMenuItem) {
    if (!window.confirm(`Archive "${item.name}"? Existing orders keep their snapshot; the dish stops appearing to travellers.`)) return;
    setArchiving(item.id);
    try {
      await apiFetch(`/api/restaurant/menu/${item.id}`, { method: "DELETE" });
      toast.success(`${item.name} archived.`);
      await mutate();
    } catch (archiveError) {
      toast.error(archiveError instanceof Error ? archiveError.message : "Could not archive the dish.");
    } finally {
      setArchiving(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kitchen catalogue"
        title="Menu"
        description="Dish names are matched exactly when bounties are created. Keep prices, prep times and availability accurate so you only receive requests you can actually fulfil."
        action={<Button onClick={() => setEditor({ mode: "create" })}><Plus /> Add dish</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dishes"
            className="pl-10"
            aria-label="Search dishes"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-56" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => void mutate()}>Refresh</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{items.length} live dish{items.length === 1 ? "" : "es"}</Badge>
        <Badge variant="success">{items.filter((item) => item.isAvailable).length} available</Badge>
        <Badge variant="muted">{items.filter((item) => !item.isAvailable).length} sold out</Badge>
        <span>Archived dishes are hidden here but stay attached to past orders.</span>
      </div>

      {error ? (
        <Card><CardContent className="p-6 text-sm text-red-700">Could not load the menu. {error.message}</CardContent></Card>
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Your menu is empty"
          description="Add at least one dish before you can receive bounties. Every requested dish must exist on this menu for your kitchen to be eligible."
          action={<Button onClick={() => setEditor({ mode: "create" })}><Plus /> Add your first dish</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching dishes"
          description="Try a different search term or category."
          action={<Button variant="outline" onClick={() => { setSearch(""); setCategory("all"); }}>Clear filters</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => (
            <Card key={item.id} className={!item.isAvailable ? "opacity-75" : undefined}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold">{item.name}</h2>
                    <Badge variant="outline">{item.category}</Badge>
                    {item.isAvailable ? <Badge variant="success">Available</Badge> : <Badge variant="muted">Sold out</Badge>}
                  </div>
                  {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatCurrency(item.price)}</span>
                    <span>{item.prepTimeMinutes} min prep</span>
                    {item.dietaryTags.length > 0 ? (
                      <span className="inline-flex items-center gap-1"><Leaf className="h-3 w-3" /> {item.dietaryTags.map((tag) => DIETARY_LABELS[tag] ?? tag).join(", ")}</span>
                    ) : null}
                    {item.allergens.length > 0 ? <span>Allergens: {item.allergens.map((tag) => ALLERGEN_LABELS[tag] ?? tag).join(", ")}</span> : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">Available</span>
                    <Switch
                      checked={item.isAvailable}
                      onCheckedChange={() => void toggleAvailability(item)}
                      disabled={toggling === item.id}
                      aria-label={`Toggle availability for ${item.name}`}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditor({ mode: "edit", item })}>
                    <Pencil /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 hover:text-red-800"
                    onClick={() => void archive(item)}
                    disabled={archiving === item.id}
                  >
                    <Trash2 /> {archiving === item.id ? "Archiving…" : "Archive"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DishDialog
        open={editor !== null}
        item={editor?.mode === "edit" ? editor.item : null}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        onSaved={async () => {
          setEditor(null);
          await mutate();
        }}
      />
    </div>
  );
}

function DishDialog({
  open,
  item,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  item: RestaurantMenuItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("199");
  const [category, setCategory] = useState("Mains");
  const [prepTime, setPrepTime] = useState("15");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setPrice(item ? String(item.price) : "199");
    setCategory(item?.category ?? "Mains");
    setPrepTime(item ? String(item.prepTimeMinutes) : "15");
    setImageUrl(item?.imageUrl ?? "");
    setIsAvailable(item?.isAvailable ?? true);
    setDietaryTags(item?.dietaryTags ?? []);
    setAllergens(item?.allergens ?? []);
  }, [item, open]);

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const priceValue = Number(price);
    const prepValue = Number(prepTime);
    if (!name.trim() || name.trim().length < 2) return toast.error("Give the dish a name.");
    if (!category.trim() || category.trim().length < 2) return toast.error("Add a category.");
    if (!Number.isFinite(priceValue) || priceValue < 1) return toast.error("Price must be at least ₹1.");
    if (!Number.isInteger(prepValue) || prepValue < 1) return toast.error("Preparation time must be a whole number of minutes.");

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: priceValue,
      category: category.trim(),
      prepTimeMinutes: prepValue,
      imageUrl: imageUrl.trim(),
      dietaryTags,
      allergens,
      isAvailable,
    };

    setSaving(true);
    try {
      if (item) {
        await patchJson(`/api/restaurant/menu/${item.id}`, payload);
        toast.success(`${payload.name} updated.`);
      } else {
        await postJson("/api/restaurant/menu", payload);
        toast.success(`${payload.name} added to the menu.`);
      }
      await onSaved();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Could not save the dish.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${item.name}` : "Add a dish"}</DialogTitle>
          <DialogDescription>
            Dish names are matched exactly for bounties. Prep time feeds the just-in-time cooking schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Dish name" htmlFor="dish-name">
              <Input id="dish-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
            </Field>
            <Field label="Category" htmlFor="dish-category">
              <Input id="dish-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} required />
            </Field>
            <Field label="Price (₹)" htmlFor="dish-price">
              <Input id="dish-price" type="number" min={1} step="1" value={price} onChange={(event) => setPrice(event.target.value)} required />
            </Field>
            <Field label="Prep time (minutes)" htmlFor="dish-prep">
              <Input id="dish-prep" type="number" min={1} max={180} step="1" value={prepTime} onChange={(event) => setPrepTime(event.target.value)} required />
            </Field>
          </div>

          <Field label="Description" htmlFor="dish-description">
            <Textarea id="dish-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="What makes this dish worth a detour?" />
          </Field>

          <Field label="Image URL (optional)" htmlFor="dish-image">
            <Input id="dish-image" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-semibold">Dietary tags</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(DIETARY_LABELS).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                    <Checkbox checked={dietaryTags.includes(value)} onCheckedChange={() => setDietaryTags((list) => toggle(list, value))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold">Allergens</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(ALLERGEN_LABELS).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                    <Checkbox checked={allergens.includes(value)} onCheckedChange={() => setAllergens((list) => toggle(list, value))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
            <div>
              <p className="text-sm font-semibold">Available to order</p>
              <p className="text-[10px] text-muted-foreground">Sold-out dishes make your kitchen ineligible for bounties containing them.</p>
            </div>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} aria-label="Dish availability" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {saving ? "Saving…" : item ? "Save changes" : "Add dish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5")}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
