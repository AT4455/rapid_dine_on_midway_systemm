"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Bell, CheckCheck, CookingPot, MapPin, ReceiptText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch, fetcher, patchJson } from "@/lib/client/api";
import type { NotificationsResponse } from "@/lib/client/types";
import { cn, timeAgo } from "@/lib/utils";

export function NotificationBell({ role }: { role: "CUSTOMER" | "RESTAURANT" }) {
  const router = useRouter();
  const { data, mutate, isLoading } = useSWR<NotificationsResponse>("/api/notifications", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  async function openNotification(id: string, orderId: string | null, bountyId: string | null) {
    try {
      await patchJson("/api/notifications", { id });
    } catch {
      /* marking read is best effort */
    }
    void mutate();
    if (orderId) router.push(`/${role === "CUSTOMER" ? "customer" : "restaurant"}/orders/${orderId}`);
    else if (bountyId) router.push(`/${role === "CUSTOMER" ? "customer" : "restaurant"}/bounties/${bountyId}`);
  }

  async function markAll() {
    try {
      const next = await apiFetch<NotificationsResponse>("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      await mutate(next, { revalidate: false });
    } catch {
      void mutate();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="flex items-center gap-2 p-0 text-sm">
            Notifications
            {unread > 0 ? <Badge variant="accent">{unread} new</Badge> : null}
          </DropdownMenuLabel>
          {unread > 0 ? (
            <button
              onClick={(event) => {
                event.preventDefault();
                void markAll();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[380px] overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet. Bounty and kitchen updates will land here.
            </p>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => void openNotification(item.id, item.orderId, item.bountyId)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-none border-b border-border/60 px-4 py-3 last:border-0",
                  !item.readAt && "bg-primary-50/60",
                )}
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-primary-700 shadow-sm">
                  <NotificationIcon type={item.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug">{item.title}</span>
                    {!item.readAt ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </span>
                  <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground/80">
                    {timeAgo(item.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "ORDER_STATUS") return <ReceiptText className="h-4 w-4" />;
  if (type === "KITCHEN_START") return <CookingPot className="h-4 w-4" />;
  if (type === "ETA_UPDATE") return <MapPin className="h-4 w-4" />;
  if (type.startsWith("BOUNTY")) return <Sparkles className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}
