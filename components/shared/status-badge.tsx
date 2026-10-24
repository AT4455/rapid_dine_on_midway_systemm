import { Badge } from "@/components/ui/badge";
import type { ComponentProps } from "react";

type Variant = ComponentProps<typeof Badge>["variant"];

const ORDER: Record<string, { label: string; variant: Variant }> = {
  PENDING: { label: "Pending", variant: "muted" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  PREPARING: { label: "Preparing", variant: "accent" },
  READY: { label: "Ready for pickup", variant: "info" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
  REJECTED: { label: "Rejected", variant: "danger" },
};

const BOUNTY: Record<string, { label: string; variant: Variant }> = {
  OPEN: { label: "Open · waiting", variant: "accent" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  EXPIRED: { label: "Expired", variant: "muted" },
  CANCELLED: { label: "Cancelled", variant: "muted" },
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = ORDER[status] ?? { label: status, variant: "outline" as Variant };
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}

export function BountyStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = BOUNTY[status] ?? { label: status, variant: "outline" as Variant };
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}

export function KitchenBadge({ open, className }: { open: boolean; className?: string }) {
  return (
    <Badge variant={open ? "success" : "muted"} className={className}>
      <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-600" : "bg-muted-foreground"}`} />
      {open ? "Open now" : "Closed"}
    </Badge>
  );
}
