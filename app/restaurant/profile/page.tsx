"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  BadgeCheck,
  Clock3,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  Star,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, patchJson } from "@/lib/client/api";
import type { RestaurantProfile } from "@/lib/client/types";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function RestaurantProfilePage() {
  const { data, error, isLoading, mutate } = useSWR<{ restaurant: RestaurantProfile }>(
    "/api/restaurant/profile",
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return <Card><CardContent className="p-6 text-sm text-red-700">Could not load your profile. {error?.message}</CardContent></Card>;
  }

  const restaurant = data.restaurant;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kitchen profile"
        title={restaurant.name}
        description="Your address and coordinates decide which journey corridors include you. Opening hours, capacity and prep times decide which bounties you are eligible for."
        action={<Button asChild variant="outline"><Link href="/restaurant/menu"><UtensilsCrossed /> Edit menu</Link></Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={restaurant.verificationStatus === "VERIFIED" ? "success" : "warning"}>
          <ShieldCheck className="h-3 w-3" /> {restaurant.verificationStatus}
        </Badge>
        <Badge variant={restaurant.isActive ? "success" : "muted"}>{restaurant.isActive ? "Accepting orders" : "Paused"}</Badge>
        <Badge variant="outline"><Star className="h-3 w-3" /> {restaurant.rating.toFixed(1)} ({restaurant.ratingCount})</Badge>
        <Badge variant="outline"><Store className="h-3 w-3" /> /{restaurant.slug}</Badge>
        <Badge variant="outline"><Clock3 className="h-3 w-3" /> {restaurant.openingTime}–{restaurant.closingTime}</Badge>
      </div>

      <ProfileForm key={restaurant.id} restaurant={restaurant} onSaved={() => void mutate()} />
    </div>
  );
}

function ProfileForm({ restaurant, onSaved }: { restaurant: RestaurantProfile; onSaved: () => void }) {
  const [name, setName] = useState(restaurant.name);
  const [description, setDescription] = useState(restaurant.description);
  const [cuisine, setCuisine] = useState(restaurant.cuisine);
  const [address, setAddress] = useState(restaurant.address);
  const [latitude, setLatitude] = useState(String(restaurant.latitude));
  const [longitude, setLongitude] = useState(String(restaurant.longitude));
  const [phone, setPhone] = useState(restaurant.phone);
  const [openingTime, setOpeningTime] = useState(restaurant.openingTime);
  const [closingTime, setClosingTime] = useState(restaurant.closingTime);
  const [pickupInstructions, setPickupInstructions] = useState(restaurant.pickupInstructions);
  const [capacityPerHour, setCapacityPerHour] = useState(String(restaurant.capacityPerHour));
  const [imageUrl, setImageUrl] = useState(restaurant.imageUrl ?? "");
  const [openDays, setOpenDays] = useState<number[]>(restaurant.openDays.length ? restaurant.openDays : [0, 1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    setOpenDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const lat = Number(latitude);
    const lng = Number(longitude);
    const capacity = Number(capacityPerHour);

    if (name.trim().length < 2) return toast.error("Enter the restaurant name.");
    if (description.trim().length < 20) return toast.error("Description needs at least 20 characters.");
    if (cuisine.trim().length < 2) return toast.error("Enter a cuisine.");
    if (address.trim().length < 10) return toast.error("Enter a fuller address.");
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return toast.error("Latitude must be between -90 and 90.");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return toast.error("Longitude must be between -180 and 180.");
    if (phone.trim().length < 7) return toast.error("Enter a contact phone number.");
    if (!/^\d{2}:\d{2}$/.test(openingTime) || !/^\d{2}:\d{2}$/.test(closingTime)) return toast.error("Use 24-hour HH:mm times.");
    if (pickupInstructions.trim().length < 5) return toast.error("Add short pickup instructions.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) return toast.error("Capacity must be 1–200 orders per hour.");
    if (openDays.length === 0) return toast.error("Choose at least one open day.");

    setSaving(true);
    try {
      await patchJson("/api/restaurant/profile", {
        name: name.trim(),
        description: description.trim(),
        cuisine: cuisine.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        phone: phone.trim(),
        openingTime,
        closingTime,
        pickupInstructions: pickupInstructions.trim(),
        capacityPerHour: capacity,
        imageUrl: imageUrl.trim(),
        openDays,
      });
      toast.success("Kitchen profile saved.");
      onSaved();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save the profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Store className="h-4 w-4" /> Identity</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Restaurant name" htmlFor="profile-name">
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
            </Field>
            <Field label="Cuisine" htmlFor="profile-cuisine">
              <Input id="profile-cuisine" value={cuisine} onChange={(event) => setCuisine(event.target.value)} maxLength={120} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="profile-description">
                <Textarea id="profile-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} required />
              </Field>
              <p className="mt-1 text-[10px] text-muted-foreground">{description.trim().length}/2000 · at least 20 characters</p>
            </div>
            <div className="sm:col-span-2">
              <Field label="Image URL (optional)" htmlFor="profile-image">
                <Input id="profile-image" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-4 w-4" /> Location & contact</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Address" htmlFor="profile-address">
                <Input id="profile-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} required />
              </Field>
            </div>
            <Field label="Latitude" htmlFor="profile-lat">
              <Input id="profile-lat" type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} required />
            </Field>
            <Field label="Longitude" htmlFor="profile-lng">
              <Input id="profile-lng" type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Phone" htmlFor="profile-phone">
                <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} required />
              </Field>
            </div>
            <p className="sm:col-span-2 text-[10px] leading-relaxed text-muted-foreground">
              Coordinates place you on journey corridors. Use the exact kitchen pin — a misplaced pin can make you
              ineligible or overstate the detour. The demo seeds verified coordinates, so change these only if your pin is
              genuinely wrong.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><UtensilsCrossed className="h-4 w-4" /> Service</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Opens" htmlFor="profile-open">
                <Input id="profile-open" type="time" value={openingTime} onChange={(event) => setOpeningTime(event.target.value)} required />
              </Field>
              <Field label="Closes" htmlFor="profile-close">
                <Input id="profile-close" type="time" value={closingTime} onChange={(event) => setClosingTime(event.target.value)} required />
              </Field>
              <Field label="Capacity / hour" htmlFor="profile-capacity">
                <Input id="profile-capacity" type="number" min={1} max={200} step="1" value={capacityPerHour} onChange={(event) => setCapacityPerHour(event.target.value)} required />
              </Field>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold">Open days</p>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => (
                  <label key={day.value} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                    <Checkbox checked={openDays.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            <Field label="Pickup instructions" htmlFor="profile-pickup">
              <Textarea
                id="profile-pickup"
                value={pickupInstructions}
                onChange={(event) => setPickupInstructions(event.target.value)}
                maxLength={500}
                placeholder="Where should the traveller collect? Parking, counter, landmark…"
                required
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-primary-200 bg-primary-50/40">
          <CardHeader className="pb-2">
            <p className="eyebrow">Eligibility</p>
            <CardTitle className="text-lg">What travellers see</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p><span className="font-semibold text-foreground">Verification: </span>{restaurant.verificationStatus === "VERIFIED" ? "verified in demo mode; bounties can be offered." : "pending; bounties are withheld until approved."}</p>
            <p><span className="font-semibold text-foreground">Hours: </span>{openingTime}–{closingTime} on {openDays.length === 7 ? "every day" : `${openDays.length} chosen day${openDays.length === 1 ? "" : "s"}`}.</p>
            <p><span className="font-semibold text-foreground">Capacity: </span>{capacityPerHour} orders/hour; at capacity, further bounties pause.</p>
            <p><span className="font-semibold text-foreground">Address: </span>{address}</p>
            <p className="flex items-start gap-1.5 rounded-lg bg-white/70 p-2.5">
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-700" />
              Saving updates the data used by matching immediately. It does not change your login email or verification status.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? "Saving…" : "Save profile"}
            </Button>
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
              Changes affect future bounties only. Accepted orders keep their recorded prep times and pickup instructions.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
