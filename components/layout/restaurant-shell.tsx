"use client";

import {
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import type { SessionUser } from "@/lib/client/types";

const NAV: NavItem[] = [
  { href: "/restaurant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/restaurant/bounties", label: "Bounties", icon: Sparkles },
  { href: "/restaurant/orders", label: "Orders", icon: ReceiptText },
  { href: "/restaurant/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/restaurant/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/restaurant/profile", label: "Profile", icon: Settings2 },
];

export function RestaurantShell({
  user,
  children,
  restaurantName,
}: {
  user: Pick<SessionUser, "name" | "email" | "isDemo">;
  children: React.ReactNode;
  restaurantName?: string;
}) {
  return (
    <AppShell
      user={user}
      role="RESTAURANT"
      nav={NAV}
      profileHref="/restaurant/profile"
      badge={restaurantName ?? "Kitchen partner"}
    >
      {children}
    </AppShell>
  );
}

export { ClipboardList };
