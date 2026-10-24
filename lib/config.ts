/**
 * Central configuration. Everything optional has a safe local-demo default.
 * Secrets are read on the server only; NEXT_PUBLIC_* values are safe to expose.
 */

const env = (key: string, fallback = "") => process.env[key]?.trim() || fallback;
const bool = (key: string, fallback: boolean) => {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
};
const int = (key: string, fallback: number) => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const config = {
  appUrl: env("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  demoMode: bool("DEMO_MODE", process.env.NODE_ENV !== "production"),
  isProduction: process.env.NODE_ENV === "production",

  auth: {
    secret:
      env("AUTH_SECRET") ||
      // Local-only fallback. Never used silently in production.
      "rapid-dine-local-development-secret-change-me",
    cookieName: "rd_session",
    sessionDays: 7,
  },

  routing: {
    provider: env("ROUTING_PROVIDER", "osrm"),
    baseUrl: env("ROUTING_BASE_URL", "https://router.project-osrm.org").replace(/\/$/, ""),
    apiKey: env("ROUTING_API_KEY"),
    timeoutMs: int("ROUTING_TIMEOUT_MS", 8000),
    fallbackSpeedKph: 42,
  },

  geocoding: {
    baseUrl: env("GEOCODING_BASE_URL", "https://nominatim.openstreetmap.org").replace(/\/$/, ""),
    userAgent: env("GEOCODING_USER_AGENT", "RapidDine/1.0 (hackathon demo)"),
    timeoutMs: int("GEOCODING_TIMEOUT_MS", 6000),
  },

  ai: {
    apiKey: env("LLM_API_KEY"),
    baseUrl: env("LLM_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, ""),
    model: env("LLM_MODEL", "gpt-4o-mini"),
    timeoutMs: int("LLM_TIMEOUT_MS", 20000),
    enabled: Boolean(env("LLM_API_KEY")),
  },

  bounty: {
    ttlMinutes: int("BOUNTY_TTL_MINUTES", 30),
    defaultCorridorMeters: int("DEFAULT_CORRIDOR_METERS", 3000),
    minCorridorMeters: 500,
    maxCorridorMeters: 15000,
    serviceFeeRate: 0.03,
    platformFee: 5,
    maxItems: 20,
    maxQuantityPerItem: 10,
  },

  kitchen: {
    tickMs: int("KITCHEN_TICK_MS", 15000),
    staleEtaMinutes: int("STALE_ETA_MINUTES", 10),
    tooSoonBufferMinutes: 5,
    readyLeadMinutes: int("READY_LEAD_MINUTES", 4),
  },

  location: {
    retentionHours: int("LOCATION_RETENTION_HOURS", 6),
    minUpdateIntervalMs: int("LOCATION_MIN_INTERVAL_MS", 2500),
    staleAfterMinutes: int("LOCATION_STALE_MINUTES", 5),
  },

  seed: {
    demoPassword: env("SEED_DEMO_PASSWORD", "Demo@1234"),
  },
} as const;

export function assertProductionConfig() {
  if (!config.isProduction) return;
  const warnings: string[] = [];
  if (config.auth.secret.startsWith("rapid-dine-local")) {
    warnings.push("AUTH_SECRET is using the insecure development fallback.");
  }
  if (warnings.length) {
    // Loud, actionable warning without leaking secrets.
    console.warn("\n[Rapid Dine security warning]\n- " + warnings.join("\n- ") + "\n");
  }
}

export function isDemoMode() {
  return config.demoMode;
}

export const demoAccounts = {
  customer: {
    email: "traveller@rapiddine.demo",
    name: "Aarav Menon",
    password: config.seed.demoPassword,
  },
  restaurant: {
    email: "owner@rapiddine.demo",
    name: "Meera Iyer",
    password: config.seed.demoPassword,
  },
} as const;
