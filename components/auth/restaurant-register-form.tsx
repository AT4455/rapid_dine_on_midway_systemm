"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/client/api";

const DEMO_POINTS = [
  { label: "Bidadi", lat: 12.8018, lng: 77.3866 },
  { label: "Ramanagara", lat: 12.7209, lng: 77.2802 },
  { label: "Maddur", lat: 12.5847, lng: 77.045 },
  { label: "Mandya", lat: 12.5223, lng: 76.8954 },
  { label: "Srirangapatna", lat: 12.4181, lng: 76.6947 },
  { label: "Mysuru", lat: 12.2958, lng: 76.6394 },
];

export function RestaurantRegisterForm() {
  const [loading, setLoading] = useState(false);
  const [lat, setLat] = useState("12.5847");
  const [lng, setLng] = useState("77.0450");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      await postJson("/api/auth/register/restaurant", {
        ownerName: String(form.get("ownerName") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        phone: String(form.get("phone") ?? ""),
        restaurantName: String(form.get("restaurantName") ?? ""),
        description: String(form.get("description") ?? ""),
        cuisine: String(form.get("cuisine") ?? ""),
        address: String(form.get("address") ?? ""),
        latitude: Number(form.get("latitude")),
        longitude: Number(form.get("longitude")),
        openingTime: String(form.get("openingTime") ?? "07:00"),
        closingTime: String(form.get("closingTime") ?? "23:00"),
        pickupInstructions: String(form.get("pickupInstructions") ?? ""),
        capacityPerHour: Number(form.get("capacityPerHour") ?? 12),
      });
      toast.success("Restaurant registered. Demo mode auto-verified your kitchen.");
      window.location.assign("/restaurant/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register the restaurant.");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Register your kitchen</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        In demo mode your kitchen is verified immediately. A production deployment would review it before offers go live.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <fieldset className="space-y-4">
          <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-700">Owner account</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ownerName">Your name</Label>
              <Input id="ownerName" name="ownerName" required autoComplete="name" placeholder="Meera Iyer" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" required autoComplete="tel" placeholder="+91 98765 43210" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder="owner@kitchen.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 chars + a number" />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-5">
          <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-700">Kitchen</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="restaurantName">Restaurant name</Label>
              <Input id="restaurantName" name="restaurantName" required placeholder="Maddur Tiffins" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input id="cuisine" name="cuisine" required placeholder="Karnataka tiffins" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Short description</Label>
            <Textarea id="description" name="description" required minLength={20} rows={3} placeholder="What makes this kitchen worth a stop? Mention signature dishes and the pickup experience." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" required placeholder="Bengaluru-Mysuru Highway, Maddur, Karnataka" />
          </div>

          <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-800">
                <MapPin className="h-3.5 w-3.5" /> Map coordinates
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] text-primary-600"><Sparkles className="h-3 w-3" /> demo shortcuts</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" name="latitude" type="number" step="0.0000001" required value={lat} onChange={(event) => setLat(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" name="longitude" type="number" step="0.0000001" required value={lng} onChange={(event) => setLng(event.target.value)} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_POINTS.map((point) => (
                <button
                  key={point.label}
                  type="button"
                  onClick={() => {
                    setLat(String(point.lat));
                    setLng(String(point.lng));
                    toast.message(`Coordinates set to ${point.label}`);
                  }}
                  className="rounded-full border border-primary-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-primary-700 hover:bg-primary-100"
                >
                  {point.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Bounties only reach kitchens inside a traveller&apos;s route corridor. Put the pin at your pickup counter.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="openingTime">Opens</Label>
              <Input id="openingTime" name="openingTime" type="time" required defaultValue="07:00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closingTime">Closes</Label>
              <Input id="closingTime" name="closingTime" type="time" required defaultValue="23:00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacityPerHour">Orders / hour</Label>
              <Input id="capacityPerHour" name="capacityPerHour" type="number" min={1} max={200} defaultValue={12} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pickupInstructions">Pickup instructions</Label>
            <Textarea id="pickupInstructions" name="pickupInstructions" required rows={2} placeholder="e.g. Take the service road exit, park by the yellow gate. Ask for the Rapid Dine shelf." />
          </div>
        </fieldset>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Register kitchen
          <ArrowRight />
        </Button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground">
        Already a partner?{" "}
        <Link href="/sign-in?role=restaurant" className="font-semibold text-primary-800 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
