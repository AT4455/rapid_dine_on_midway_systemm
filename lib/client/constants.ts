/** Client-safe constants. Keep in sync with lib/validation.ts and lib/config.ts. */

export const DEMO_PASSWORD = "Demo@1234";

export const DIETARY_OPTIONS = [
  { value: "VEGETARIAN", label: "Vegetarian" },
  { value: "VEGAN", label: "Vegan" },
  { value: "GLUTEN_FREE", label: "Gluten free" },
  { value: "HALAL", label: "Halal" },
  { value: "JAIN", label: "Jain" },
  { value: "DAIRY_FREE", label: "Dairy free" },
] as const;

export const ALLERGEN_OPTIONS = [
  { value: "NUTS", label: "Nuts" },
  { value: "DAIRY", label: "Dairy" },
  { value: "GLUTEN", label: "Gluten" },
  { value: "EGG", label: "Egg" },
  { value: "SOY", label: "Soy" },
  { value: "SHELLFISH", label: "Shellfish" },
  { value: "SESAME", label: "Sesame" },
] as const;

export const DIETARY_LABELS: Record<string, string> = {
  VEGETARIAN: "Vegetarian",
  VEGAN: "Vegan",
  GLUTEN_FREE: "Gluten free",
  HALAL: "Halal",
  JAIN: "Jain",
  SPICY: "Spicy",
  CONTAINS_NUTS: "Contains nuts",
  DAIRY_FREE: "Dairy free",
};

export const ALLERGEN_LABELS: Record<string, string> = {
  NUTS: "Nuts",
  DAIRY: "Dairy",
  GLUTEN: "Gluten",
  EGG: "Egg",
  SOY: "Soy",
  SHELLFISH: "Shellfish",
  SESAME: "Sesame",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

export const BOUNTY_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open · waiting",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const SERVICE_FEE_RATE = 0.03;
export const PLATFORM_FEE = 5;

/** Mirrors feesForSubtotal() in lib/matching.ts for the cart estimate. */
export function estimateFees(subtotal: number) {
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100;
  return Math.round((serviceFee + PLATFORM_FEE) * 100) / 100;
}

export const CHART_CATEGORY_COLORS = [
  "bg-primary-500",
  "bg-orange-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
];
