"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoLoginButtons } from "@/components/marketing/demo-login";
import { postJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type Role = "CUSTOMER" | "RESTAURANT";
type LoginResponse = { redirectTo: string };

export function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next");
  const initialRole: Role = params.get("role") === "restaurant" ? "RESTAURANT" : "CUSTOMER";
  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await postJson<LoginResponse>("/api/auth/login", { email, password, role });
      toast.success("Welcome back");
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : data.redirectTo;
      // Full reload drops the previous account's SWR cache and Socket.IO session.
      window.location.assign(target);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-5 inline-flex rounded-full border border-border bg-muted/60 p-1">
        {(["CUSTOMER", "RESTAURANT"] as Role[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRole(option)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
              role === option ? "bg-white text-primary-900 shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "CUSTOMER" ? "Traveller" : "Kitchen partner"}
          </button>
        ))}
      </div>

      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {role === "CUSTOMER" ? "Welcome back, traveller." : "Welcome back to the kitchen."}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {role === "CUSTOMER"
          ? "Pick up where your journey left off."
          : "Check today's queue and the bounties on your route."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <span className="text-[11px] text-muted-foreground">Demo password: Demo@1234</span>
          </div>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="pl-10 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Sign in
          <ArrowRight />
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">or use the demo</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <DemoLoginButtons showHint={false} />

      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/sign-in?mode=register" className="font-semibold text-primary-800 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
