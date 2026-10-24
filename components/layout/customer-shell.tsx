"use client";

import {
  Compass,
  LayoutDashboard,
  MessageCircle,
  ReceiptText,
  Route,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { useCart } from "@/components/providers/cart-provider";
import type { SessionUser } from "@/lib/client/types";

const NAV: NavItem[] = [
  { href: "/customer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customer/journeys", label: "Journeys", icon: Route },
  { href: "/customer/bounties", label: "Bounties", icon: Sparkles },
  { href: "/customer/orders", label: "Orders", icon: ReceiptText },
  { href: "/customer/assistant", label: "Food assistant", icon: MessageCircle },
  { href: "/customer/profile", label: "Profile", icon: UserRound },
];

export function CustomerShell({
  user,
  children,
}: {
  user: Pick<SessionUser, "name" | "email" | "isDemo">;
  children: React.ReactNode;
}) {
  const cart = useCart();

  return (
    <AppShell
      user={user}
      role="CUSTOMER"
      nav={NAV}
      cart={{ count: cart.count, href: "/customer/cart" }}
      profileHref="/customer/profile"
      badge="Traveller"
    >
      {children}
    </AppShell>
  );
}

export function CustomerQuickLink() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700">
      <Compass className="h-3.5 w-3.5" /> Discover along the way
    </span>
  );
}
