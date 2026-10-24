"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, Loader2, MapPin, Route, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PlaceField, type Place } from "@/components/customer/place-field";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/client/api";
import type { DiscoveredRestaurant, Journey } from "@/lib/client/types";
import { formatDistance, formatDuration } from "@/lib/utils";

const DEMO_START: Place = { label: "Bengaluru, Karnataka, India", lat: 12.9716, lng: 77.5946 };
const DEMO_END: Place = { label: "Mysuru, Karnataka, India", lat: 12.2958, lng: 76.6394 };

type JourneyResponse = {
  journey: Journey;
  route: { provider: string; isFallback: boolean; warning: string | null; distanceMeters: number; durationSeconds: number };
  restaurants: DiscoveredRestaurant[];
  eligibleCount: number;
};

export default function NewJourneyPage() {
  const router = useRouter();
  const [start, setStart] = useState<Place | null>(null);
  const [end, setEnd] = useState<Place | null>(null);
  const [corridorKm, setCorridorKm] = useState(3);
  const [startTracking, setStartTracking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!start || !end) {
      toast.error("Choose both a start and a destination from the search results.");
      return;
    }
    setLoading(true);
    try {
      const data = await postJson<JourneyResponse>("/api/journeys", {
        startLabel: start.label,
        startLat: start.lat,
        startLng: start.lng,
        endLabel: end.label,
        endLat: end.lat,
        endLng: end.lng,
        corridorMeters: corridorKm * 1000,
        startTracking,
      });
      toast.success(
        `${data.eligibleCount} kitchen${data.eligibleCount === 1 ? "" : "s"} found inside your corridor.`,
        { description: data.route.isFallback ? "Routing provider unavailable — using a labelled fallback route." : `${formatDistance(data.route.distanceMeters)} · ${formatDuration(data.route.durationSeconds)}` },
      );
      router.push(`/customer/journeys/${data.journey.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not plan the journey.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Plan a drive"
        title="Where are you heading?"
        description="We build a real driving route, then keep only the verified kitchens inside your detour corridor. Wider corridors mean more choice, longer detours."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/customer/journeys"><ArrowLeft /> All journeys</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">Route</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline"><MapPin className="h-3 w-3" /> OpenStreetMap search</Badge>
              <Badge variant="outline">OSRM routing</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <PlaceField label="Starting from" hint="pickup point A" value={start} onChange={setStart} placeholder="e.g. Bengaluru" />
              <PlaceField label="Destination" hint="pickup point B" value={end} onChange={setEnd} placeholder="e.g. Mysuru" accent="accent" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Demo corridor</span>
              <button
                type="button"
                onClick={() => {
                  setStart(DEMO_START);
                  setEnd(DEMO_END);
                  toast.message("Loaded the seeded Bengaluru → Mysuru route");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 hover:bg-primary-100"
              >
                <Sparkles className="h-3.5 w-3.5" /> Bengaluru → Mysuru
              </button>
              <span className="text-[11px] text-muted-foreground">6 verified kitchens seeded along this road</span>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="corridor" className="flex items-center gap-1.5">
                  <Compass className="h-4 w-4 text-primary-700" /> Detour corridor
                </Label>
                <span className="text-sm font-bold tabular-nums">{corridorKm.toFixed(1)} km</span>
              </div>
              <input
                id="corridor"
                type="range"
                min={0.5}
                max={15}
                step={0.5}
                value={corridorKm}
                onChange={(event) => setCorridorKm(Number(event.target.value))}
                className="mt-3 w-full accent-primary-700"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0.5 km · strict</span>
                <span>3 km · balanced</span>
                <span>15 km · flexible</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                We buffer the driving polyline by this distance. Detour is approximated as twice the perpendicular
                distance to the road — useful for comparing kitchens, not a live turn-by-turn instruction.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
              <Checkbox checked={startTracking} onCheckedChange={(checked) => setStartTracking(checked === true)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold">Start location sharing now</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  Optional. Sharing keeps your ETA fresh for the kitchen. You can stop at any time and precise points
                  are deleted. Without it, the kitchen uses the planned arrival time.
                </span>
              </span>
            </label>

            <Button type="submit" size="lg" className="w-full" disabled={loading || !start || !end}>
              {loading ? <Loader2 className="animate-spin" /> : <Route />}
              Build route & find kitchens
              <ArrowRight />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
