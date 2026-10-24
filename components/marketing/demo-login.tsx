"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Utensils, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client/api";

type DemoResponse = { redirectTo: string; user: { name: string; role: string } };

export function DemoLoginButtons({
  size = "default",
  showHint = true,
  className,
}: {
  size?: "default" | "lg" | "sm";
  showHint?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState<"CUSTOMER" | "RESTAURANT" | null>(null);

  async function login(role: "CUSTOMER" | "RESTAURANT") {
    setLoading(role);
    try {
      const data = await postJson<DemoResponse>("/api/auth/demo", { role });
      toast.success(`Signed in as ${data.user.name}`);
      // Full reload drops the previous account's SWR cache and Socket.IO session.
      window.location.assign(data.redirectTo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demo login failed.");
      setLoading(null);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size={size}
          variant="dark"
          onClick={() => void login("CUSTOMER")}
          disabled={loading !== null}
        >
          {loading === "CUSTOMER" ? <Loader2 className="animate-spin" /> : <Utensils />}
          Try as a traveller
          <ArrowRight />
        </Button>
        <Button
          size={size}
          variant="outline"
          onClick={() => void login("RESTAURANT")}
          disabled={loading !== null}
        >
          {loading === "RESTAURANT" ? <Loader2 className="animate-spin" /> : <UtensilsCrossed />}
          Try as a kitchen
        </Button>
      </div>
      {showHint ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Seeded demo accounts · password <span className="font-semibold text-foreground">Demo@1234</span> · no payment is taken.
        </p>
      ) : null}
    </div>
  );
}
