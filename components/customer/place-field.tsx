"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GeocodeResponse } from "@/lib/client/types";

export type Place = { label: string; lat: number; lng: number };

export function PlaceField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  accent = "primary",
}: {
  label: string;
  hint?: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder: string;
  accent?: "primary" | "accent";
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<GeocodeResponse["results"]>([]);
  const [source, setSource] = useState<"nominatim" | "demo" | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onOutside(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (value) setQuery(value.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, value?.label]);

  function search(text: string) {
    setQuery(text);
    setError(null);
    onChange(null);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`, { credentials: "same-origin" });
        const payload = (await response.json()) as { ok: boolean; data?: GeocodeResponse; error?: { message: string } };
        if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Search failed.");
        setResults(payload.data.results);
        setSource(payload.data.results[0]?.source ?? null);
        setWarning(payload.data.warning ?? null);
        setOpen(true);
      } catch (searchError) {
        setError(searchError instanceof Error ? searchError.message : "Could not search places.");
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 380);
  }

  return (
    <div className="space-y-1.5" ref={box}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-semibold">{label}</label>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => search(event.target.value)}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
          placeholder={placeholder}
          className={cn("pl-10 pr-10", accent === "accent" && "focus-visible:ring-orange-200")}
          autoComplete="off"
        />
        {loading ? <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
        {value ? <MapPin className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-600" /> : null}

        {open ? (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
            {error ? (
              <p className="px-4 py-3 text-xs text-red-700">{error}</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">No places found. Try a town or landmark name.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto py-1">
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-muted"
                      onClick={() => {
                        onChange({ label: result.label, lat: result.lat, lng: result.lng });
                        setQuery(result.label);
                        setOpen(false);
                      }}
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{result.shortLabel}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{result.label}</span>
                      </span>
                      {result.source === "demo" ? <Badge variant="warning" className="ml-auto shrink-0">demo</Badge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {warning ? (
              <p className="border-t border-border bg-amber-50 px-3.5 py-2 text-[10px] leading-relaxed text-amber-800">{warning}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      {source === "demo" && value ? (
        <p className="text-[10px] text-amber-700">Labelled demo place — address search is offline or rate-limited.</p>
      ) : null}
    </div>
  );
}
