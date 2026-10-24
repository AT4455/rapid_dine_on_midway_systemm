/**
 * Load `.env` / `.env.local` before any module reads `process.env`.
 *
 * `next dev` and `next build` load env files themselves, but a custom server
 * evaluates its own imports first. Import this module at the very top of
 * `server.ts` so `lib/config.ts` sees the configured secrets and provider URLs.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
