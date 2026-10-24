"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  meta?: string;
  kind?: "start" | "end" | "restaurant" | "driver" | "stop";
};

export type MapInnerProps = {
  route?: [number, number][];
  markers?: MapMarker[];
  fitKey?: string;
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
  className?: string;
};

const COLORS: Record<NonNullable<MapMarker["kind"]>, { bg: string; glyph: string }> = {
  start: { bg: "#1a392b", glyph: "A" },
  end: { bg: "#f97316", glyph: "B" },
  restaurant: { bg: "#2d6b4b", glyph: "🍽" },
  stop: { bg: "#0ea5e9", glyph: "•" },
  driver: { bg: "#2563eb", glyph: "➤" },
};

function markerIcon(kind: NonNullable<MapMarker["kind"]>) {
  const color = COLORS[kind];
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:999px;border:2px solid #fff;background:${color.bg};color:#fff;font-size:12px;font-weight:800;box-shadow:0 4px 14px rgba(13,32,24,.32)">${color.glyph}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey?: string }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14, animate: false });
    // Refit only when the journey/marker set changes, not on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  return null;
}

export default function MapInner({
  route = [],
  markers = [],
  fitKey,
  center = [12.9716, 77.5946],
  zoom = 11,
  interactive = true,
  className = "h-[360px] w-full",
}: MapInnerProps) {
  const bounds: [number, number][] = [
    ...route.map(([lng, lat]) => [lat, lng] as [number, number]),
    ...markers.map((marker) => [marker.lat, marker.lng] as [number, number]),
  ];

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        className="z-0 h-full w-full rounded-2xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={bounds} fitKey={fitKey} />
        {route.length > 1 ? (
          <Polyline positions={route.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: "#2d6b4b", weight: 5, opacity: 0.75 }} />
        ) : null}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={markerIcon(marker.kind ?? "restaurant")}
          >
            <Popup>
              <strong className="block text-xs font-bold">{marker.label}</strong>
              {marker.meta ? <span className="mt-1 block text-[11px] text-muted-foreground">{marker.meta}</span> : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
