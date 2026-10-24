"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Bot,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetcher, patchJson } from "@/lib/client/api";
import { DIETARY_OPTIONS } from "@/lib/client/constants";
import type { SessionUser } from "@/lib/client/types";

type CustomerProfilePayload = {
  user: SessionUser;
  profile: {
    id: string;
    userId: string;
    dietaryPreferences: string[];
    allergies: string | null;
    defaultBudget: number;
    currency: string;
    homeCity: string | null;
  } | null;
};

export default function CustomerProfilePage() {
  const { data, error, isLoading, mutate } = useSWR<CustomerProfilePayload>("/api/customer/profile", fetcher);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return <Card><CardContent className="p-6 text-sm text-red-700">Could not load your profile. {error?.message}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Traveller profile"
        title={data.user.name}
        description="Your dietary preferences and allergies guide the food assistant. Your default budget pre-fills bounties and gives the assistant a spending frame."
        action={<Button asChild variant="outline"><Link href="/customer/assistant"><Bot /> Ask the assistant</Link></Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success"><ShieldCheck className="h-3 w-3" /> Signed in</Badge>
        <Badge variant="outline"><Mail className="h-3 w-3" /> {data.user.email}</Badge>
        {data.user.isDemo ? <Badge variant="warning">Demo account</Badge> : null}
        {data.profile ? <Badge variant="outline"><Wallet className="h-3 w-3" /> ₹{data.profile.defaultBudget} default budget</Badge> : null}
      </div>

      <ProfileForm key={data.user.id} data={data} onSaved={() => void mutate()} />
    </div>
  );
}

function ProfileForm({ data, onSaved }: { data: CustomerProfilePayload; onSaved: () => void }) {
  const { user, profile } = data;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [homeCity, setHomeCity] = useState(profile?.homeCity ?? "");
  const [allergies, setAllergies] = useState(profile?.allergies ?? "");
  const [defaultBudget, setDefaultBudget] = useState(String(profile?.defaultBudget ?? 500));
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(profile?.dietaryPreferences ?? []);
  const [saving, setSaving] = useState(false);

  function togglePreference(value: string) {
    setDietaryPreferences((current) => (current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const budget = Number(defaultBudget);

    if (name.trim().length < 2) return toast.error("Enter your name.");
    if (phone.trim() && phone.trim().length < 7) return toast.error("Enter a valid phone number or leave it blank.");
    if (!Number.isFinite(budget) || budget < 0 || budget > 100000) return toast.error("Default budget must be between ₹0 and ₹1,00,000.");
    if (allergies.trim().length > 500) return toast.error("Keep allergies under 500 characters.");

    setSaving(true);
    try {
      await patchJson("/api/customer/profile", {
        name: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        homeCity: homeCity.trim(),
        allergies: allergies.trim(),
        defaultBudget: budget,
        dietaryPreferences,
      });
      toast.success("Preferences saved.");
      onSaved();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><UserRound className="h-4 w-4" /> About you</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="customer-name">
              <Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
            </Field>
            <Field label="Phone" htmlFor="customer-phone">
              <Input id="customer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} placeholder="Optional" />
            </Field>
            <Field label="Email" htmlFor="customer-email">
              <Input id="customer-email" value={user.email} readOnly disabled />
            </Field>
            <Field label="Home city" htmlFor="customer-city">
              <Input id="customer-city" value={homeCity} onChange={(event) => setHomeCity(event.target.value)} maxLength={120} placeholder="e.g. Bengaluru" />
            </Field>
            <p className="sm:col-span-2 text-[10px] leading-relaxed text-muted-foreground">
              Your email is the sign-in identity and cannot be changed in this demo. Phone is kept optional and is shared
              with a kitchen only while an order is active.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-4 w-4" /> Food preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-semibold">Dietary preferences</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {DIETARY_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs">
                    <Checkbox
                      checked={dietaryPreferences.includes(option.value)}
                      onCheckedChange={() => togglePreference(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">These guide recommendations; they are not sent to kitchens automatically.</p>
            </div>

            <Field label="Allergies & intolerances" htmlFor="customer-allergies">
              <Textarea
                id="customer-allergies"
                value={allergies}
                onChange={(event) => setAllergies(event.target.value)}
                maxLength={500}
                placeholder="e.g. Severe peanut allergy; avoid shellfish."
              />
            </Field>
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-900">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Allergies are shown to the assistant so it can warn you. It never guarantees a dish is allergen-free — always
              confirm with the kitchen.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-4 w-4" /> Budget</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Default bounty budget (₹)" htmlFor="customer-budget">
              <Input
                id="customer-budget"
                type="number"
                min={0}
                max={100000}
                step="1"
                value={defaultBudget}
                onChange={(event) => setDefaultBudget(event.target.value)}
              />
            </Field>
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Includes the 3% service fee and ₹5 platform fee when a bounty is matched. The assistant also uses this as a
              spending frame.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-primary-200 bg-primary-50/40">
          <CardHeader className="pb-2">
            <p className="eyebrow">Privacy</p>
            <CardTitle className="text-lg">What is stored</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Your account, saved preferences and order history live in the app database; the browser storage is never the source of truth.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Precise journey points are pruned after six hours and deleted when you end a journey.</p>
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> A kitchen sees your first name, phone and live point only while your order is active.</p>
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> You can stop sharing your location at any time from the order page.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? "Saving…" : "Save preferences"}
            </Button>
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
              Preferences update immediately. Existing orders keep the notes and details recorded when they were placed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quick links</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm"><Link href="/customer/journeys">Journeys</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/customer/bounties">Bounties</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/customer/orders">Orders</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/customer/assistant">Assistant</Link></Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
