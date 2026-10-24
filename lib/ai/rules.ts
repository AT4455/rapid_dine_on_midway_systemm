import type { DiscoveredRestaurant } from "../services/discovery";

export type AiMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  prepTimeMinutes: number;
  dietaryTags: string[];
  allergens: string[];
};

export type AiRestaurant = Pick<
  DiscoveredRestaurant,
  | "id"
  | "name"
  | "cuisine"
  | "etaMinutes"
  | "detourMeters"
  | "openNow"
  | "activeOrders"
  | "capacityPerHour"
  | "rating"
  | "prepTimeMinutes"
  | "priceRange"
  | "dietaryTags"
  | "suitabilityLabel"
> & { menu: AiMenuItem[] };

export type AssistantContext = {
  userName: string;
  dietaryPreferences: string[];
  allergies: string;
  budget: number;
  currency: string;
  journey: {
    id: string;
    startLabel: string;
    endLabel: string;
    durationMinutes: number;
    corridorMeters: number;
    status: string;
  } | null;
  restaurants: AiRestaurant[];
};

const DIET_KEYWORDS: Record<string, string> = {
  vegan: "VEGAN",
  vegetarian: "VEGETARIAN",
  veg: "VEGETARIAN",
  jain: "JAIN",
  halal: "HALAL",
  "gluten free": "GLUTEN_FREE",
  "gluten-free": "GLUTEN_FREE",
  "dairy free": "DAIRY_FREE",
  "dairy-free": "DAIRY_FREE",
};

const ALLERGY_KEYWORDS: Record<string, string[]> = {
  peanut: ["NUTS", "PEANUT"],
  nut: ["NUTS"],
  dairy: ["DAIRY", "MILK"],
  milk: ["DAIRY", "MILK"],
  gluten: ["GLUTEN", "WHEAT"],
  wheat: ["GLUTEN", "WHEAT"],
  egg: ["EGG"],
  soy: ["SOY"],
  shellfish: ["SHELLFISH"],
  prawn: ["SHELLFISH"],
  sesame: ["SESAME"],
};

export function extractBudget(message: string, fallback: number) {
  const patterns = [
    /(?:under|below|within|budget(?: of| is)?|upto|up to|around)\s*(?:₹|rs\.?|inr)?\s*([\d,]{2,7})/i,
    /(?:₹|rs\.?|inr)\s*([\d,]{2,7})/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value >= 20) return value;
    }
  }
  return fallback;
}

export function requestedDiets(message: string) {
  const lower = message.toLowerCase();
  return Object.entries(DIET_KEYWORDS)
    .filter(([keyword]) => lower.includes(keyword))
    .map(([, tag]) => tag);
}

function allergyTokens(allergies: string) {
  const lower = allergies.toLowerCase();
  const tokens = new Set<string>();
  for (const [keyword, tags] of Object.entries(ALLERGY_KEYWORDS)) {
    if (lower.includes(keyword)) tags.forEach((t) => tokens.add(t));
  }
  return tokens;
}

export function itemAllergenWarning(item: AiMenuItem, tokens: Set<string>) {
  if (!tokens.size) return false;
  const text = [item.name, item.description ?? "", ...item.allergens, ...item.dietaryTags]
    .join(" ")
    .toUpperCase();
  return [...tokens].some((token) => text.includes(token));
}

function dishMatches(item: AiMenuItem, words: string[]) {
  if (!words.length) return 0;
  const haystack = `${item.name} ${item.description ?? ""} ${item.dietaryTags.join(" ")}`.toLowerCase();
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

const STOP_WORDS = new Set([
  "what", "where", "which", "should", "could", "would", "along", "route", "food", "eat",
  "order", "please", "recommend", "suggest", "something", "under", "budget", "the", "and",
  "for", "with", "near", "my", "me", "a", "an", "is", "are", "can", "you", "i", "we",
]);

export type RuleReply = {
  reply: string;
  suggestions: string[];
  recommended: Array<{ restaurantId: string; restaurantName: string; items: string[] }>;
};

/**
 * Deterministic, data-grounded fallback. Every price/name/ETA below comes from
 * the database context — nothing is invented. Used when no LLM key is set or
 * the provider fails.
 */
export function ruleBasedReply(context: AssistantContext, message: string): RuleReply {
  const lower = message.toLowerCase();
  const budget = extractBudget(message, context.budget || 500);
  const dietTags = new Set([...context.dietaryPreferences, ...requestedDiets(message)]);
  const allergies = allergyTokens(context.allergies);
  const queryWords = lower
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const wantsSpicy = lower.includes("spicy");
  const wantsQuick = lower.includes("quick") || lower.includes("fast");

  if (!context.journey) {
    return {
      reply:
        "I can only recommend real kitchens once I know your route. Open **Plan a journey**, set your start and destination, then come back — I'll shortlist open restaurants inside your corridor with dishes that fit your budget and prep window.",
      suggestions: [
        "Plan a Bengaluru → Mysuru journey",
        "What budget should I set?",
        "How does the route corridor work?",
      ],
      recommended: [],
    };
  }

  const scored = context.restaurants
    .filter((r) => r.openNow && r.activeOrders < r.capacityPerHour && r.menu.length)
    .map((restaurant) => {
      const timeBuffer = restaurant.etaMinutes - restaurant.prepTimeMinutes;
      const items = restaurant.menu
        .filter((item) => item.price <= budget)
        .filter((item) => {
          if (!dietTags.size) return true;
          const tags = new Set(item.dietaryTags.map((t) => t.toUpperCase()));
          return [...dietTags].every((tag) => tags.has(tag)) || tags.has("VEGAN");
        })
        .filter((item) => !itemAllergenWarning(item, allergies))
        .map((item) => ({
          item,
          score:
            dishMatches(item, queryWords) * 4 +
            (wantsSpicy && item.dietaryTags.includes("SPICY") ? 2 : 0) +
            (dietTags.size ? 2 : 0) +
            (timeBuffer >= 5 ? 2 : 0) +
            (wantsQuick ? Math.max(0, 10 - item.prepTimeMinutes) / 5 : 0),
        }))
        .sort((a, b) => b.score - a.score || a.item.price - b.item.price)
        .slice(0, 2)
        .map((x) => x.item);

      return { restaurant, items, timeBuffer };
    })
    .filter((entry) => entry.items.length > 0)
    .sort((a, b) => {
      if (a.timeBuffer >= 5 && b.timeBuffer < 5) return -1;
      if (b.timeBuffer >= 5 && a.timeBuffer < 5) return 1;
      return b.restaurant.rating - a.restaurant.rating;
    })
    .slice(0, 3);

  if (!scored.length) {
    return {
      reply: `I couldn't find an open kitchen inside your **${(context.journey.corridorMeters / 1000).toFixed(1)} km** corridor with available dishes ${context.allergies ? "that avoid your declared allergens " : ""}for **₹${budget}** or less right now.\n\nTry widening the corridor, raising the budget, or removing a dietary filter. I will never invent availability that isn't in the database.`,
      suggestions: ["Widen my corridor to 5 km", "Show all cuisines", "What is a realistic budget?"],
      recommended: [],
    };
  }

  const lines = scored.map(({ restaurant, items, timeBuffer }) => {
    const itemText = items
      .map((i) => `${i.name} — ₹${i.price.toFixed(0)} (${i.prepTimeMinutes} min prep)`)
      .join("; ");
    const bufferText =
      timeBuffer >= 0
        ? `you arrive in ~${restaurant.etaMinutes} min, ${timeBuffer} min of buffer`
        : `arrival in ~${restaurant.etaMinutes} min is tighter than prep`;
    return `• **${restaurant.name}** · ${restaurant.cuisine} · ${restaurant.detourMeters} m detour\n  ${itemText}\n  ${bufferText}.`;
  });

  const allergyNote = context.allergies.trim()
    ? `\n\n⚠️ You listed **${context.allergies.trim()}** as an allergy. I filtered items tagged with matching allergens, but kitchens can cross-contaminate — confirm directly before ordering.`
    : "";
  const feeNote = "\n\nCheckout adds a 3% service fee + ₹5 platform fee; your budget check already includes both.";

  return {
    reply: `Here are real, bookable options along **${context.journey.startLabel} → ${context.journey.endLabel}** within **₹${budget}**:\n\n${lines.join("\n\n")}${allergyNote}${feeNote}`,
    suggestions: [
      "Which option has the most time buffer?",
      "Any vegetarian options under ₹250?",
      "What if my ETA is delayed?",
    ],
    recommended: scored.map(({ restaurant, items }) => ({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      items: items.map((i) => i.name),
    })),
  };
}
