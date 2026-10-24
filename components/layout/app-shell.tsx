"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LogOut, Settings2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/lib/client/types";
import { cn, initials } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export function AppShell({
  user,
  role,
  nav,
  children,
  cart,
  profileHref,
  badge,
}: {
  user: Pick<SessionUser, "name" | "email" | "isDemo">;
  role: "CUSTOMER" | "RESTAURANT";
  nav: NavItem[];
  children: React.ReactNode;
  cart?: { count: number; href: string };
  profileHref: string;
  badge?: string;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href.endsWith("/dashboard")) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {user.isDemo ? (
        <div className="bg-primary-950 px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-cream/80">
          Demo workspace · seeded Bengaluru → Mysuru data · GPS, payments and live provider calls may be simulated
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="container-wide flex h-16 items-center gap-3">
          <Logo href={role === "CUSTOMER" ? "/customer/dashboard" : "/restaurant/dashboard"} />

          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Primary">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    isActive(item.href)
                      ? "bg-primary-100 text-primary-900"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {badge ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-[11px] font-semibold text-primary-700 sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                {badge}
              </span>
            ) : null}

            {cart && cart.count > 0 ? (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href={cart.href}>Cart · {cart.count}</Link>
              </Button>
            ) : null}

            <NotificationBell role={role} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
                  <Avatar className="h-9 w-9 border border-primary-200">
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-sm font-semibold">{user.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={profileHref} className="cursor-pointer">
                    <Settings2 className="mr-2 h-4 w-4" /> Profile & preferences
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()} className="cursor-pointer text-red-700 focus:text-red-700">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="border-t border-border/60 lg:hidden">
          <nav className="container-wide hide-scrollbar flex items-center gap-1 overflow-x-auto py-2" aria-label="Primary mobile">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                    isActive(item.href) ? "bg-primary-100 text-primary-900" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
            {cart && cart.count > 0 ? (
              <Link
                href={cart.href}
                className="inline-flex shrink-0 items-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Cart · {cart.count}
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="container-wide flex-1 py-6 sm:py-8">{children}</main>

      <footer className="border-t border-border/60 py-6">
        <div className="container-wide flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Rapid Dine · route-aware food bounties for travellers</p>
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {role === "CUSTOMER" ? "Traveller workspace" : "Kitchen workspace"} · mock payments, no real charges
          </p>
        </div>
      </footer>
    </div>
  );
}
