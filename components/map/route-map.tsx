"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapInnerProps } from "./map-inner";

export type { MapMarker } from "./map-inner";

const MapInner = dynamic<MapInnerProps>(() => import("./map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] w-full rounded-2xl" />,
});

/** Leaflet must never render on the server, so this is the only entry point. */
export function RouteMap(props: MapInnerProps) {
  return <MapInner {...props} />;
}
