# Rapid Dine

**Route-aware food ordering for people on the move.** Rapid Dine connects a traveller's journey with kitchens along the route. Instead of ordering from a fixed address, the traveller posts a **bounty**: "I am driving Bengaluru → Mysuru, here is my route, budget and pickup window — who can feed me?" Eligible kitchens see only the bounties they can actually serve, one accepts atomically, and the kitchen is prompted to start cooking just in time for the traveller's arrival.

Two connected apps share one database, one auth system and one realtime layer:

| App | Entry point | Audience |
| --- | --- | --- |
| Customer (traveller) | `/customer` | Plan journeys, discover kitchens, post bounties, order, track live status |
| Restaurant (partner) | `/restaurant` | Receive corridor-matched bounties, accept/reject, run the kitchen queue, manage menu/profile |

A public landing page lives at `/`, with sign-in and registration for both roles.

> This repository also contains the original static portfolio site (`index.html`, `css/`, `js/`, `assets/`). It is untouched and documented separately in [`PORTFOLIO.md`](./PORTFOLIO.md).

---

## Contents

- [Feature highlights](#feature-highlights)
- [Architecture](#architecture)
- [How the core workflow works](#how-the-core-workflow-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database migrations and seed data](#database-migrations-and-seed-data)
- [Demo accounts](#demo-accounts)
- [External services and fallbacks](#external-services-and-fallbacks)
- [Tests and verification](#tests-and-verification)
- [Deployment](#deployment)
- [Security and privacy notes](#security-and-privacy-notes)
- [Known limitations](#known-limitations)

---

## Feature highlights

### Traveller app

- **Journey planner** with address search, route preview on an OpenStreetMap/Leaflet map, distance, drive time and a configurable corridor width.
- **Route-aware discovery**: only kitchens inside the journey corridor are considered, with detour distance and route progress shown.
- **Persistent bounties**: choose dishes, quantity, budget and a pickup note. The bounty stays open until a kitchen accepts, the traveller cancels, or it expires.
- **Transparent pricing**: item subtotal plus a 3% service fee and ₹5 platform fee; the budget check includes fees.
- **Orders**: live status, ETA, pickup instructions, status history, and a demo journey simulator that moves the traveller along the route.
- **AI food assistant** with menu-aware suggestions; falls back to deterministic rules when no LLM key is configured.
- **In-app notifications** for bounty and order events.

### Restaurant app

- **Only relevant bounties**: a kitchen sees a bounty only when it is verified, active, open, under capacity, has every requested dish available, fits the budget, and lies inside the corridor.
- **One winner**: acceptance is a conditional atomic update, so two kitchens cannot accept the same bounty.
- **Kitchen queue** with just-in-time cooking alerts derived from the traveller's ETA and the dishes' preparation time.
- **Order lifecycle** with server-validated transitions (`PENDING → ACCEPTED → PREPARING → READY → COMPLETED`, plus cancellation/rejection rules).
- **Menu CRUD** with availability, pricing, prep time, dietary tags and allergens.
- **Profile editor** for hours, capacity, pickup instructions and contact details.

### Shared

- Server-assigned roles, httpOnly cookie sessions, protected layouts, Zod validation, same-origin checks and rate limiting.
- Same-origin Socket.IO live updates for order status, bounties, kitchen alerts and notifications.
- Money stored as MySQL `DECIMAL(10,2)` and handled as numbers only at the display/calculation boundary.
- Demo data is clearly labelled; simulated journeys and the demo auth are disabled with `DEMO_MODE=false`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (React 19)                           │
│   /customer/*            /restaurant/*            / (landing)        │
│   SWR data fetching      SWR data fetching        static marketing   │
│   Leaflet route map      kitchen queue            sign-in/register   │
└───────────────┬──────────────────────────────┬───────────────────────┘
                │ HTTPS (same origin)          │ WebSocket (same origin)
┌───────────────▼──────────────────────────────▼───────────────────────┐
│                    Custom Node server (`server.ts`)                  │
│  ┌────────────────────────┐   ┌───────────────────────────────────┐  │
│  │ Next.js 15 App Router  │   │ Socket.IO server                  │  │
│  │ pages + route handlers │   │ JWT cookie auth, per-order rooms  │  │
│  └───────────┬────────────┘   └───────────────────────────────────┘  │
│              │                                                       │
│  ┌───────────▼────────────┐   ┌───────────────────────────────────┐  │
│  │ Domain services        │   │ JIT kitchen scheduler (15 s tick) │  │
│  │ matching, bounties,    │   │ MySQL-backed, idempotent          │  │
│  │ orders, kitchen, geo   │   └───────────────────────────────────┘  │
│  └───────────┬────────────┘                                          │
└──────────────┼───────────────────────────────────────────────────────┘
               │ Prisma Client
┌──────────────▼───────────────────────────────────────────────────────┐
│                              MySQL 8                                 │
│  users, journeys, restaurants, menus, bounties, offers, orders,      │
│  status history, short-lived location updates, notifications, AI     │
└──────────────────────────────────────────────────────────────────────┘
```

Key decisions:

- **One process for HTTP, WebSocket and scheduling.** `server.ts` creates an HTTP server, hands requests to Next's request handler, and attaches Socket.IO to the same server. That keeps cookies same-origin and avoids CORS entirely.
- **Server-first authorization.** `middleware.ts` performs a cheap signed-cookie gate for `/customer/*` and `/restaurant/*`; every layout and API route then re-checks the role and restaurant membership against the database. Middleware is not treated as the only line of defence.
- **Pure domain logic is testable.** Corridor matching, fee calculation, status transitions, kitchen timing, room access and ownership checks live in framework-free modules under `lib/` and are covered by Vitest.
- **Persistent state, not `localStorage`.** Carts use `sessionStorage` only as a convenience; bounties, orders and journeys are always server-side. No authoritative data lives in the browser.

---

## How the core workflow works

### 1. Plan a journey

`POST /api/journeys` validates start/end points and a corridor width, asks the routing provider for a driving route, then stores the polyline, distance and duration. If routing is unavailable, a labelled straight-line fallback is used (`isFallback: true`).

### 2. Post a bounty

`POST /api/bounties` validates the journey, dishes, quantities, budget and expiry. Bounty items keep the requested dish names plus a reference price, so a kitchen that uses a different menu item name can still match by normalized dish name.

### 3. Match kitchens

`lib/matching.ts` evaluates each candidate restaurant:

1. active and `VERIFIED`;
2. open at the current local time (supports overnight hours and per-day schedules);
3. active order count below `capacityPerHour`;
4. every requested dish available and not archived;
5. subtotal + 3% service fee + ₹5 platform fee within the bounty budget;
6. inside the journey corridor (`lib/geo.ts`, Turf.js buffer around the route).

For each match the system stores a `BountyOffer` with distance from route, detour, route progress, ETA and the matched total. Only restaurants with a `PENDING` offer can see or act on the bounty.

### 4. Accept atomically

`POST /api/bounties/:id/accept`:

- re-checks that the bounty is still `OPEN`, not expired, and that this kitchen still has a valid offer;
- re-validates eligibility and prices (the menu may have changed);
- performs a conditional update: `updateMany({ where: { id, status: "OPEN" }, data: { status: "ACCEPTED", acceptedRestaurantId } })`;
- only the request that changes one row proceeds; everything else gets a conflict;
- creates the order and order items in the same transaction, rejects the other offers, and emits realtime events.

### 5. Cook just in time

The kitchen scheduler runs every 15 seconds (`KITCHEN_TICK_MS`) inside `server.ts`, and is also exposed as `POST /api/kitchen/tick` for serverless/cron deployments. For each accepted order it computes:

```
startCookingAfter = max(0, customerETA - preparationTime)
```

When that moment arrives, it adds a one-time kitchen alert (`KITCHEN_START`), marks the order as ready to start, and emits a Socket.IO event. The operation is idempotent, so overlapping ticks cannot duplicate alerts. Preparation time is the longest item prep time plus a small queue allowance, clamped to sensible bounds.

### 6. Follow the order

Traveller location updates (simulated in demo mode) update ETA and progress. Status changes are validated by `lib/kitchen.ts`, recorded in `OrderStatusHistory`, and broadcast to the order room. Customers see status, ETA and pickup instructions; restaurants see the queue and action buttons.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js **15.5.28** (App Router), React **19.1.1**, TypeScript 5 |
| Styling | Tailwind CSS 3.4, shadcn/ui-style primitives on Radix UI, Sonner toasts |
| Database | MySQL 8, Prisma **6.19.3** |
| Validation | Zod |
| Auth | JWT (`jose`) in an httpOnly cookie, bcryptjs password hashes |
| Realtime | Socket.IO 4 (server + client) |
| Data fetching | SWR |
| Maps | Leaflet + react-leaflet, OpenStreetMap tiles |
| Geo | Turf.js |
| AI | OpenAI-compatible chat completions with a rule-based fallback |
| Tests | Vitest |
| Runtime | Node.js ≥ 20, `tsx` for the TypeScript custom server |

---

## Project structure

```
app/
  (public)/                 landing, sign-in, registration (route group)
  customer/                 traveller pages (dashboard, journeys, restaurants,
                            cart, bounties, orders, assistant, profile)
  restaurant/               partner pages (dashboard, bounties, orders,
                            kitchen, menu, profile)
  onboarding/restaurant/    restaurant accounts without a linked kitchen
  api/                      route handlers (auth, journeys, bounties, orders,
                            restaurant, kitchen tick, geocode, AI, health)
components/
  ui/                       shared UI primitives
  shared/                   headers, empty states, maps, live updates, etc.
  customer/ restaurant/     feature components
lib/
  auth/                     session, password, guards, authorization, CSRF
  services/                 bounty, order, kitchen scheduler, discovery
  ai/                       assistant + rule fallback
  client/                   client-safe API helpers, types, socket
  config.ts                 server config (never import from client code)
  matching.ts               eligibility and fee logic
  geo.ts                    corridor matching and ETA helpers
  kitchen.ts                prep timing and status transitions
  restaurants.ts            opening hours, labels, images
  realtime/                 room names, access rules, event server
  validation.ts             Zod schemas
prisma/
  schema.prisma             data model
  migrations/               committed SQL migrations
  seed.ts                   deterministic demo data
scripts/
  mysql-local.ps1           isolated MySQL 8 instance for Windows
tests/                      Vitest unit tests
server.ts                   Next + Socket.IO + scheduler
middleware.ts               fast cookie gate for protected areas
```

---

## Local setup

### Prerequisites

- Node.js **20 or newer** (tested on Node 24)
- MySQL **8.x** (or MariaDB 11.4) reachable from the app
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Set a real `AUTH_SECRET` (at least 32 random characters). For local-only use, the template's MySQL URL and demo flags are ready to go.

### 3. Start MySQL

**Option A — use an existing MySQL 8 server.** Create the database:

```sql
CREATE DATABASE rapiddine CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Point `DATABASE_URL` at it, for example:

```env
DATABASE_URL="mysql://user:password@127.0.0.1:3306/rapiddine"
```

**Option B — use the isolated local instance (Windows).** This creates a project-local data directory in `.mysql/` on port **3307**, so it does not touch any existing MySQL service:

```bash
npm run db:local:init     # first run: initialise, start, create the database
npm run db:local:start    # later runs
npm run db:local:stop     # stop it
```

The helper looks for MySQL in the standard Program Files locations. Override with `MYSQL_HOME` / `MYSQL_PORT` if needed. The default URL `mysql://root@127.0.0.1:3307/rapiddine` matches `.env.example`.

### 4. Apply the schema and seed

```bash
npm run db:deploy   # apply committed migrations
npm run db:seed     # deterministic demo data (safe to re-run)
```

For schema experimentation during development, `npm run db:migrate` creates a new migration.

### 5. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. The custom server prints the Socket.IO and scheduler startup line.

Production-style run:

```bash
npm run build
npm start
```

Stop one server before starting the other, and clear `.next` when switching modes. On Windows folders synced by OneDrive, Next's generated `.next/types` entries can be left as reparse points that make the next `next dev` fail with `EINVAL ... readlink '.next/types/routes.d.ts'`. `Remove-Item -Recurse -Force .next` fixes it; both servers recreate what they need.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev + Socket.IO + scheduler via `tsx server.ts` |
| `npm run build` | `prisma generate` + `next build` |
| `npm start` | Production custom server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest run (unit tests) |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Reset and seed demo data |
| `npm run db:studio` | Prisma Studio |

---

## Environment variables

All variables are read on the server except `NEXT_PUBLIC_*`. Never put secrets in `NEXT_PUBLIC_*`.

| Variable | Required | Default / notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | `mysql://root@127.0.0.1:3307/rapiddine` in the template |
| `AUTH_SECRET` | Yes in production | ≥32 random chars; local fallback exists but warns in production |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000`; public metadata and Socket.IO fallback |
| `DEMO_MODE` | No | `true` locally; set `false` for real deployments (disables demo logins/simulator) |
| `ROUTING_PROVIDER` | No | `osrm` |
| `ROUTING_BASE_URL` | No | `https://router.project-osrm.org` |
| `ROUTING_API_KEY` | No | Sent as a bearer token when set |
| `ROUTING_TIMEOUT_MS` | No | `8000` |
| `GEOCODING_BASE_URL` | No | `https://nominatim.openstreetmap.org` |
| `GEOCODING_USER_AGENT` | No | Identify your deployment to Nominatim |
| `NEXT_PUBLIC_MAP_TILE_URL` | No | OpenStreetMap tile URL |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | No | Tile attribution |
| `LLM_API_KEY` | No | Empty → deterministic rule-based assistant |
| `LLM_BASE_URL` | No | `https://api.openai.com/v1` (any OpenAI-compatible API) |
| `LLM_MODEL` | No | `gpt-4o-mini` |
| `LLM_TIMEOUT_MS` | No | `20000` |
| `SOCKET_CORS_ORIGIN` | No | Only needed if Socket.IO is split onto another origin |
| `BOUNTY_TTL_MINUTES` | No | `30` |
| `DEFAULT_CORRIDOR_METERS` | No | `3000` |
| `KITCHEN_TICK_MS` | No | `15000` |
| `READY_LEAD_MINUTES` | No | `4` |
| `LOCATION_RETENTION_HOURS` | No | `6` |
| `SEED_DEMO_PASSWORD` | No | `Demo@1234` |

`.env` and `.env.local` are git-ignored. `.env.example` contains placeholders only.

---

## Database migrations and seed data

The schema is defined in `prisma/schema.prisma`. A single initial migration is committed under `prisma/migrations/`.

- Money columns use `DECIMAL(10,2)`; Prisma serializes them as strings, and the UI normalizes with `toNumber`/`formatCurrency`.
- `RouteGeometry` stores GeoJSON-order `[lng, lat]` pairs.
- `LocationUpdate` is deliberately short-lived; only the current journey's recent points are kept.
- `BountyOffer` has a unique `(bountyId, restaurantId)` constraint.
- Indices support the common queries: open bounties by expiry, offers by restaurant and status, orders by customer/restaurant and status.

`npm run db:seed` is deterministic and idempotent: it deletes demo transactional data, upserts users, restaurants and menus, then creates journeys, bounties, offers, orders and notifications.

Seeded route: **Bengaluru → Mysuru** (~145 km) with six verified kitchens along the corridor:

| Restaurant | Location |
| --- | --- |
| The Filter Coffee Stop | Bidadi |
| Nandi Kitchen | Ramanagara |
| Maddur Tiffins | Maddur |
| Cauvery Spice Kitchen | Mandya |
| Srirangapatna Healthy Bowls | Srirangapatna |
| Mysuru Palace Cafe | Mysuru |

Shared dish names such as Masala Dosa, Filter Coffee, Paneer Wrap and Veg Biryani make multi-kitchen bounty matching visible in the demo.

---

## Demo accounts

All seeded accounts use the password **`Demo@1234`** unless `SEED_DEMO_PASSWORD` is overridden.

| Role | Email | Notes |
| --- | --- | --- |
| Traveller | `traveller@rapiddine.demo` | Aarav Menon — primary demo customer, journeys and bounties |
| Traveller | `diya@rapiddine.demo` | Diya Sharma — second customer, populates kitchen orders |
| Restaurant owner | `owner@rapiddine.demo` | Meera Iyer — The Filter Coffee Stop (Bidadi) |
| Restaurant owner | `owner.nandi@rapiddine.demo` | Rohan Rao — Nandi Kitchen |
| Restaurant owner | `owner.maddur@rapiddine.demo` | Lakshmi Gowda — Maddur Tiffins |
| Restaurant owner | `owner.cauvery@rapiddine.demo` | Imran Khan — Cauvery Spice Kitchen |
| Restaurant owner | `owner.bowls@rapiddine.demo` | Ananya Shetty — Srirangapatna Healthy Bowls |
| Restaurant owner | `owner.palace@rapiddine.demo` | Vikram Urs — Mysuru Palace Cafe |

The sign-in page also has one-click demo buttons when `DEMO_MODE=true`.

---

## External services and fallbacks

| Service | Used for | If unavailable |
| --- | --- | --- |
| OSRM (public demo server by default) | Driving route geometry, distance, duration | Straight-line route with a 42 km/h estimate; `isFallback: true` and a visible "approximate" label |
| Nominatim | Address search / geocoding | Manual latitude/longitude entry and seeded place suggestions |
| OpenStreetMap tiles | Leaflet map | Map hidden gracefully; text addresses and stops remain usable |
| OpenAI-compatible LLM | Assistant chat | Deterministic intent/rule engine over the live menu |
| Socket.IO | Live order/bounty updates | Pages poll via SWR `refreshInterval` and manual refresh |

The public OSRM and Nominatim endpoints are rate-limited and have no SLA. Point `ROUTING_BASE_URL` and `GEOCODING_BASE_URL` at your own instances for anything beyond a demo.

---

## Tests and verification

```bash
npm test
npm run typecheck
npm run build
```

The suite contains **67 tests across 6 files**:

| File | Coverage |
| --- | --- |
| `tests/kitchen.test.ts` | prep-time calculation, JIT start time, status transition matrix, terminal states |
| `tests/matching.test.ts` | eligibility rules, fee math, budget checks, corridor inputs |
| `tests/geo.test.ts` | corridor filtering, detour/progress, route sanitization, ETA, bounding boxes |
| `tests/restaurants.test.ts` | opening hours (overnight, 24h, closed days), dietary scores, capacity labels |
| `tests/realtime-access.test.ts` | Socket.IO order/bounty room authorization |
| `tests/authz.test.ts` | restaurant ownership guard and same-origin/CSRF behaviour |

The production build was verified with `next build` (23 routes compile; all static pages prerender), and the production custom server was smoke-tested with `NODE_ENV=production tsx server.ts` against the seeded MySQL database (health check, landing page, demo login, traveller dashboard and kitchen dashboard).

---

## Deployment

Rapid Dine needs a **long-running Node process** because Socket.IO and the kitchen scheduler live in the same server as Next. This is not a fit for a purely serverless Next deployment without changes.

Recommended shape:

1. **MySQL 8** — managed MySQL (PlanetScale, RDS, Azure Database, etc.) or a managed VM.
2. **Node host** — Railway, Render, Fly.io, a VPS, or a container platform. Expose one port; the app serves HTTP and WebSocket on it.
3. **Reverse proxy** — forward WebSocket upgrades for `/socket.io/` and set a generous read timeout.
4. **Build and migrate** in the release step:

   ```bash
   npm ci
   npx prisma migrate deploy
   npm run build
   npm start
   ```

   (If `npx` is unavailable in your environment, run the binaries through `node`, e.g. `node node_modules/prisma/build/index.js migrate deploy`.)

5. **Environment** — set `DATABASE_URL`, a strong `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, and `DEMO_MODE=false`. Optionally set routing/geocoding/LLM credentials.

If you must run on a serverless platform:

- deploy the Next app without the custom server and remove Socket.IO from the browser path (SWR polling remains);
- run `POST /api/kitchen/tick` from a cron/queue every 15–30 seconds;
- use a shared rate-limit store and a hosted realtime service if you need live events at scale.

---

## Security and privacy notes

- **Sessions** are signed JWTs in an httpOnly, SameSite=Lax cookie (`rd_session`), with `Secure` in production. There is no token in `localStorage`.
- **Passwords** are hashed with bcryptjs; login responses do not reveal whether an email exists.
- **Roles are server-assigned.** Registration chooses customer vs restaurant, but the role is written by the server and cannot be escalated by request payload.
- **Protected pages** are guarded in middleware and again in layouts; APIs use `requireApiUser` / `requireApiCustomer` and restaurant membership checks.
- **Mutations** require a same-origin request (`assertSameOrigin`) to reduce CSRF risk; cookies are also SameSite.
- **Validation** uses Zod schemas for every write endpoint, with length and numeric bounds.
- **Rate limits** are enforced in memory per IP for login, registration, demo login and other sensitive actions. This is per-instance only; use Redis for multi-instance deployments.
- **Realtime rooms** are authorized from the database membership/ownership, not from client-provided IDs.
- **Bounty privacy**: a restaurant sees the customer's name only, not precise location or contact details, until it accepts. Customer-side and restaurant-side detail payloads deliberately differ.
- **Location** is stored only for the active journey and retained for `LOCATION_RETENTION_HOURS` (default 6). No background tracking is performed; the demo simulator is labelled.
- **Secrets** live in `.env` and `lib/config.ts` is server-only. Client code imports `lib/client/constants.ts`, which contains no secrets.

---

## Known limitations

These are intentional trade-offs for a hackathon build, and are labelled in the UI where relevant:

- **Corridor matching is geometric, not turn-by-turn.** `lib/geo.ts` buffers the route polyline with Turf and reports detour as twice the perpendicular distance. A production version should ask the routing provider for the actual route via each kitchen.
- **Public routing/geocoding endpoints** are rate-limited and best-effort; the straight-line fallback is an estimate, not a real road route.
- **Opening hours are naive local times.** They use the server's local timezone and do not model holidays or timezone changes along the route.
- **No payments.** The budget, subtotal and fees are real calculations, but no payment processor is integrated. Orders are pay-on-pickup in the demo.
- **Notifications are in-app only.** No email, SMS or push provider is wired up.
- **Rate limiting is in-memory.** It resets on restart and is not shared across instances.
- **Demo simulator.** Journey movement is generated on the server for demonstration; real GPS ingestion would require a mobile client and additional consent handling.
- **Restaurant verification is simplified.** New restaurants are auto-verified when `DEMO_MODE=true` and remain `PENDING` otherwise; there is no admin review UI.
- **No password reset or email verification.** Demo accounts and seeded data are the intended entry points.
- **AI assistant quality depends on the provider.** Without `LLM_API_KEY` it uses a small deterministic rule engine and says so.
- **Map tiles require internet access.** The rest of the app degrades to addresses and text status.
- **Dependency audit.** `npm audit --omit=dev` reports advisories in Prisma CLI transitive packages, PostCSS (via Next's build tooling) and Zod 3. Full remediation requires major upgrades (Prisma 7, Next 16, Zod 4) that were out of scope for the pinned hackathon stack. All Zod collection inputs are explicitly length-capped.

---

## License

Hackathon project — no license declared. The original portfolio content in `PORTFOLIO.md` retains its own authorship and usage terms.
