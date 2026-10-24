export type OpeningHours = {
  openingTime: string;
  closingTime: string;
  openDays: unknown;
};

/**
 * `openDays` is stored as a JSON array of numbers (0 = Sunday), but older rows
 * and API payloads may contain numeric strings. Accept both.
 */
function openDayList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export function isRestaurantOpen(restaurant: OpeningHours, now = new Date()) {
  const days = openDayList(restaurant.openDays);
  if (days.length && !days.includes(now.getDay())) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = restaurant.openingTime.split(":").map(Number);
  const [closeH, closeM] = restaurant.closingTime.split(":").map(Number);
  const open = (openH || 0) * 60 + (openM || 0);
  const close = (closeH || 0) * 60 + (closeM || 0);
  if (close === open) return true; // 24 hours
  if (close > open) return minutes >= open && minutes < close;
  // Overnight, e.g. 18:00 → 02:00
  return minutes >= open || minutes < close;
}

export function nextOpeningLabel(restaurant: OpeningHours, now = new Date()) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const openDays = openDayList(restaurant.openDays);
  if (!openDays.length) return `Daily ${restaurant.openingTime}`;
  for (let i = 0; i < 7; i++) {
    const day = (now.getDay() + i) % 7;
    if (openDays.includes(day)) {
      if (i === 0) return `Today ${restaurant.openingTime}`;
      return `${days[day]} ${restaurant.openingTime}`;
    }
  }
  return restaurant.openingTime;
}

export function dietaryMatchScore(preferences: string[], tags: string[]) {
  if (!preferences.length) return 0;
  const set = new Set(tags.map((t) => t.toUpperCase()));
  return preferences.reduce((score, pref) => score + (set.has(pref.toUpperCase()) ? 1 : 0), 0);
}

export function dietLabel(tag: string) {
  const map: Record<string, string> = {
    VEGETARIAN: "Vegetarian",
    VEGAN: "Vegan",
    GLUTEN_FREE: "Gluten free",
    HALAL: "Halal",
    JAIN: "Jain",
    SPICY: "Spicy",
    CONTAINS_NUTS: "Contains nuts",
    DAIRY_FREE: "Dairy free",
  };
  return map[tag.toUpperCase()] ?? tag;
}

export function capacityLabel(activeOrders: number, capacity: number) {
  const ratio = capacity > 0 ? activeOrders / capacity : 1;
  if (ratio >= 1) return { label: "Kitchen full", tone: "busy" as const };
  if (ratio >= 0.7) return { label: "Busy kitchen", tone: "warm" as const };
  return { label: "Taking orders", tone: "free" as const };
}

export const CUISINE_IMAGES: Record<string, string> = {
  "South Indian": "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=1200&q=70",
  "North Indian": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=70",
  Biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=70",
  Cafe: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=70",
  "Street Food": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=70",
  "Healthy Bowls": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=70",
  default: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=70",
};

export function restaurantImage(cuisine: string, imageUrl?: string | null) {
  if (imageUrl) return imageUrl;
  return CUISINE_IMAGES[cuisine] ?? CUISINE_IMAGES.default;
}
