"use client";

import { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import { useSocketEvent } from "@/lib/client/socket";

/**
 * Revalidates cached API data whenever the server pushes a relevant event.
 * A short debounce collapses bursts (for example a bounty broadcast).
 */
export function LiveUpdates() {
  const { mutate } = useSWRConfig();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, {
        revalidate: true,
      });
    }, 450);
  };

  useSocketEvent("notification:new", refresh);
  useSocketEvent("order:statusUpdated", refresh);
  useSocketEvent("bounty:accepted", refresh);
  useSocketEvent("bounty:rejected", refresh);
  useSocketEvent("bounty:created", refresh);
  useSocketEvent("customer:etaUpdated", refresh);
  useSocketEvent("kitchen:startCooking", refresh);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}
