"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/client/api";
import { DIETARY_OPTIONS } from "@/lib/client/constants";

export function CustomerRegisterForm() {
  const [loading, setLoading] = useState(false);
  const [dietary, setDietary] = useState<string[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      await postJson("/api/auth/register/customer", {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        phone: String(form.get("phone") ?? "") || undefined,
        homeCity: String(form.get("homeCity") ?? "") || undefined,
        allergies: String(form.get("allergies") ?? "") || undefined,
        dietaryPreferences: dietary,
      });
      toast.success("Traveller account created");
      window.location.assign("/customer/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create your account.");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Create your traveller account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Free, no card details. You&apos;ll plan your first journey next.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required minLength={2} autoComplete="name" placeholder="Aarav Menon" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="phone" name="phone" autoComplete="tel" placeholder="+91 98765 43210" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 chars + a number" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="homeCity">Home city <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="homeCity" name="homeCity" placeholder="Bengaluru" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Dietary preferences</Label>
          <div className="grid grid-cols-2 gap-2">
            {DIETARY_OPTIONS.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-medium">
                <Checkbox
                  checked={dietary.includes(option.value)}
                  onCheckedChange={(checked) =>
                    setDietary((current) =>
                      checked === true ? [...current, option.value] : current.filter((value) => value !== option.value),
                    )
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="allergies">Allergies <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea id="allergies" name="allergies" rows={2} placeholder="e.g. peanuts, shellfish" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Shared kitchens cannot guarantee allergen-free food. We show this warning on every order.
          </p>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Create account
          <ArrowRight />
        </Button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/sign-in" className="font-semibold text-primary-800 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
