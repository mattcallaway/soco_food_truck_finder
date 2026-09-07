# SoCo Food Truck Finder

A production-quality full-stack web application for discovering scheduled mobile food vendors (food trucks, trailers, carts, pop-ups, taco stands) throughout **Sonoma County, California**.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · MapLibre GL JS · Firebase/Firestore · Vitest · Playwright

**Repo:** https://github.com/mattcallaway/soco_food_truck_finder  
**Current branch:** `main` · **Last sprint commit:** `fdb8db7`

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Repository Map](#3-repository-map)
4. [Domain Model](#4-domain-model)
5. [Data Flow](#5-data-flow)
6. [Local Setup — Demo Mode](#6-local-setup--demo-mode)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Firebase Production Setup](#8-firebase-production-setup)
9. [Admin Authorization — Custom Claims](#9-admin-authorization--custom-claims)
10. [Security Architecture](#10-security-architecture)
11. [Ingestion Pipeline](#11-ingestion-pipeline)
12. [Map Architecture](#12-map-architecture)
13. [Running Tests](#13-running-tests)
14. [Deployment](#14-deployment)
15. [Known Gaps & Next Steps](#15-known-gaps--next-steps)
16. [Agent & LLM Handoff Notes](#16-agent--llm-handoff-notes)

---

## 1. Product Overview

Two audiences, one codebase:

| Audience | Entry Point | Purpose |
|---|---|---|
| **Public users** | `http://localhost:3000/` | Discover food trucks today, filter by city/cuisine/dietary, save favourites, view vendor & venue profiles |
| **Administrators** | `http://localhost:3000/admin` | Manage vendors, venues, sources, appearances; run ingestion pipeline; review extraction candidates |

The app is designed to be **configurable for any geographic service area** — Sonoma County is the default but every location-specific constant is in `src/config/app-config.ts`.

---

## 2. Architecture Overview

```
Browser
  │
  ├── Public pages  /  /vendors/[slug]  /venues/[slug]  /favorites
  │     └── reads via  src/lib/db/store.ts  (getPublicAppearances, getVendors, …)
  │
  └── Admin pages   /admin/**
        ├── reads/writes via  src/lib/db/store.ts  (getAdminAppearances, upsertVendor, …)
        └── API calls via     src/lib/api/admin-fetch.ts
              │
              └── /api/admin/sources/fetch   (ingestion + SSRF guard)
              └── /api/admin/geocode         (nominatim proxy + SSRF guard)

src/lib/db/store.ts  ← unified repository façade
  │
  ├── DATA_MODE=firebase  →  src/lib/db/firestore-store.ts  (Firestore)
  └── DATA_MODE=demo      →  src/lib/seed/sonoma-seed.ts    (in-memory)

/api/admin/** routes
  └── requireAdmin(request)  ←  src/lib/api/require-admin.ts
        └── firebase-admin verifyIdToken → decoded.admin custom claim
```

### Data mode selection

`getDataMode()` in `store.ts` returns `'firebase'` when `NEXT_PUBLIC_DATA_MODE=firebase` **and** at least one Firebase env var is set, otherwise `'demo'`. In `NODE_ENV=production`, demo mode causes a hard error (`checkProductionSafety()`).

---

## 3. Repository Map

```
soco_food_truck_finder/
├── src/
│   ├── app/                          Next.js App Router pages & API routes
│   │   ├── page.tsx                  Public homepage (discovery)
│   │   ├── favorites/page.tsx        Saved vendors (localStorage)
│   │   ├── vendors/[slug]/page.tsx   Vendor profile
│   │   ├── venues/[slug]/page.tsx    Venue profile
│   │   ├── admin/
│   │   │   ├── layout.tsx            Auth guard — redirects unauthenticated users
│   │   │   ├── page.tsx              Admin dashboard
│   │   │   ├── login/page.tsx        Firebase auth login (+ dev demo toggle)
│   │   │   ├── appearances/page.tsx  Appearance CRUD
│   │   │   ├── vendors/page.tsx      Vendor CRUD
│   │   │   ├── venues/page.tsx       Venue CRUD + geocoding
│   │   │   ├── sources/page.tsx      Source management + fetch trigger
│   │   │   ├── review-queue/page.tsx Candidate approve/reject UI
│   │   │   └── audit/page.tsx        Admin audit log viewer
│   │   └── api/admin/
│   │       ├── sources/fetch/route.ts  POST — fetch URL, extract, deduplicate
│   │       └── geocode/route.ts        POST — geocode address via Nominatim
│   │
│   ├── components/
│   │   ├── MapLibreMap.tsx           Interactive map (markers, flyTo, popups)
│   │   ├── VendorCard.tsx            Appearance card (list view)
│   │   ├── VendorProfile.tsx         Full vendor detail component
│   │   └── …
│   │
│   ├── config/
│   │   └── app-config.ts            APP_CONFIG, SONOMA_CITIES, taxonomies
│   │
│   ├── context/
│   │   └── AuthContext.tsx           Firebase auth state + admin claim detection
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── admin-fetch.ts        Client: attaches Bearer token to admin API calls
│   │   │   ├── require-admin.ts      Server: verifies token + admin custom claim
│   │   │   └── ssrf-guard.ts         Server: DNS + IP range + redirect SSRF protection
│   │   ├── db/
│   │   │   ├── store.ts              Unified repository façade (public + admin methods)
│   │   │   └── firestore-store.ts    Firestore implementation of all store methods
│   │   ├── firebase/
│   │   │   ├── client.ts             Firebase JS SDK init (client-side)
│   │   │   └── admin-config.ts       Firebase Admin SDK init (server-side only)
│   │   ├── ingestion/
│   │   │   └── schedule-extractor.ts Heuristic parser: text → ExtractionCandidate[]
│   │   ├── seed/
│   │   │   └── sonoma-seed.ts        Demo data (fictional vendors, venues, appearances)
│   │   └── timezone/
│   │       └── index.ts              LA timezone helpers (getDateLA, formatTimeDisplay)
│   │
│   └── types/
│       └── index.ts                  All domain interfaces (canonical source of truth)
│
├── tests/
│   ├── domain.test.ts               Unit tests — timezone, isCurrentlyOpen, aliases, favs
│   ├── repair-acceptance.test.ts    Unit tests — requireAdmin, SSRF guard, extractor, filters
│   └── e2e/
│       ├── admin-review-queue.spec.ts  Playwright — admin ingestion flow
│       ├── core-discovery-flow.spec.ts Playwright — public homepage, map, filters, profiles
│       └── mobile-map-flow.spec.ts     Playwright — mobile map/list toggle
│
├── firestore.rules                  Firestore security rules
├── firestore.indexes.json           Composite indexes for appearance queries
├── firebase.json                    Emulator config + rules/indexes deployment
├── .firebaserc                      Project alias (soco-food-truck-finder)
├── .env.example                     All supported env vars with descriptions
├── AGENTS.md                        Rules injected into agent context by Next.js
├── ARCHITECTURE.md                  Deep-dive architecture document  ←  see this file
├── REPAIR_PLAN.md                   Post-audit repair task list (historical)
└── playwright.config.ts             Playwright — chromium + Mobile Chrome, baseURL :3000
```

---

## 4. Domain Model

All interfaces live in [`src/types/index.ts`](src/types/index.ts).

```
Vendor          — a mobile food business (food truck, cart, popup…)
  └── has many  Appearance  — a scheduled instance at a Venue on a date
  └── has many  Source      — URLs to monitor for schedule updates
  └── has one   Menu        — structured items, image, or link

Venue           — a physical location (brewery, market, plaza…)
  └── has many  Appearance
  └── aliases[] — alternate names used for fuzzy matching

Source          — a URL (website, Instagram, Facebook, ICS, RSS)
  └── entityType: 'vendor' | 'venue' | 'event' | 'system'
  └── lastContentHash — SHA-256 for deduplication

SourceFetch     — one recorded HTTP fetch of a Source
Observation     — one extracted schedule signal from a SourceFetch
ExtractionCandidate — a proposed Appearance awaiting admin review

Appearance
  └── isPublished: boolean   — controls public visibility
  └── status: 'scheduled' | 'cancelled' | 'completed' | 'tentative'
  └── observationIds[]       — provenance links back to Observations

AdminAuditLog   — immutable record of every admin write action
UserProfile     — Firestore user doc (display only; role field is NOT authoritative)
```

**Key invariant:** `Appearance.isPublished === true && status === 'scheduled'` is the only condition that makes an appearance visible to public users. The `getPublicAppearances()` function enforces this — never call `getAdminAppearances()` from a public route.

---

## 5. Data Flow

### Public discovery
```
GET / → page.tsx
  → getPublicAppearances({ date, city, … })   [store.ts]
  → filters: isPublished=true AND status='scheduled'
  → returns Appearance[] joined with Vendor[] and Venue[]
  → renders VendorCard + MapLibreMap
```

### Admin ingestion
```
Admin UI: "Fetch Source" button
  → adminFetch('/api/admin/sources/fetch', { sourceId, url })   [admin-fetch.ts]
        └── Authorization: Bearer <firebase-id-token>

POST /api/admin/sources/fetch   [route.ts]
  → requireAdmin(request)           verify token + admin custom claim
  → guardedFetch(url)               SSRF protection
  → SHA-256 hash → compare to source.lastContentHash
  → if unchanged → return { status: 'unchanged' }
  → node-html-parser → strip tags → plain text
  → extractScheduleCandidates({ sourceId, vendorId, rawText, sourcePublicationTime })
  → save ExtractionCandidate[] to store
  → return candidates to UI

Admin UI: Review Queue
  → approve(candidate) → store.approveCandidate(id)
        → creates Appearance with isPublished=true
        → links observationIds for provenance
```

### Authorization flow
```
Client                        Server
  │                             │
  ├─ getIdToken() ─────────────►│
  │  (Firebase JS SDK)          │
  │                             ├─ requireAdmin(request)
  │  Bearer <token> ───────────►│   adminAuth.verifyIdToken(token, checkRevoked=true)
  │                             │   decoded.admin === true?  ← custom claim ONLY
  │                             │   return uid  OR  401/403
```

---

## 6. Local Setup — Demo Mode

```bash
# 1. Clone
git clone https://github.com/mattcallaway/soco_food_truck_finder.git
cd soco_food_truck_finder

# 2. Install
npm install

# 3. Configure (copy env template — all defaults work for demo mode)
cp .env.example .env.local

# 4. Run
npm run dev
# → http://localhost:3000
```

In demo mode the app uses fictional seed data from `src/lib/seed/sonoma-seed.ts`. No Firebase account is needed.

**Admin access in demo mode:**
1. Go to `http://localhost:3000/admin/login`
2. Toggle **"Enable Demo Admin (Dev Only)"** — visible only when `NODE_ENV=development`
3. You now have full admin access with an in-memory store

> ⚠️ The demo admin toggle is completely absent in production builds. It is gated by `NODE_ENV !== 'production'` in both the UI and the server middleware.

---

## 7. Environment Variables Reference

Copy `.env.example` → `.env.local`. All variables with defaults work in demo mode without changes.

### Application
| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | `SoCo Food Truck Finder` | Displayed in page title |
| `NEXT_PUBLIC_SERVICE_AREA` | `Sonoma County, CA` | Displayed in map footer |

### Map
| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_MAP_TILE_URL` | CARTO Positron GL style | Any MapLibre-compatible style JSON URL |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | OSM + CARTO attribution | HTML string shown in map corner |
| `NEXT_PUBLIC_MAP_CENTER_LAT` | `38.4404` | Santa Rosa, CA |
| `NEXT_PUBLIC_MAP_CENTER_LNG` | `-122.7141` | Santa Rosa, CA |
| `NEXT_PUBLIC_MAP_ZOOM` | `11` | Initial zoom level |

### Geocoding
| Variable | Default | Notes |
|---|---|---|
| `GEOCODING_API_URL` | Nominatim OSM | Server-side only. Change to a paid provider for production. |

### Firebase Client SDK (required for `DATA_MODE=firebase`)
| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From Firebase Console → Project Settings |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | |

### Firebase Admin SDK (server-side only — never exposed to browser)
| Variable | Notes |
|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | From service account JSON |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Newlines as `\n` in `.env` file |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | Alternative: full JSON string (overrides the three vars above) |

### Data Mode
| Variable | Values | Notes |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `demo` (default) \| `firebase` | Controls which store is used client-side |
| `DATA_MODE` | `demo` \| `firebase` | Server-side override (for API routes) |

### SSRF Protection
| Variable | Default | Notes |
|---|---|---|
| `SSRF_ALLOWED_DOMAINS` | `*` (all public) | Comma-separated domain allowlist for source fetching. Set in production. |

---

## 8. Firebase Production Setup

### Step 1 — Create Firebase project
1. [console.firebase.google.com](https://console.firebase.google.com) → New project
2. Enable **Firestore Database** (production mode)
3. Enable **Authentication** → Sign-in method → Email/Password (and/or Google)

### Step 2 — Get credentials
- **Client SDK:** Project Settings → Your apps → Web app → Config object
- **Admin SDK:** Project Settings → Service accounts → Generate new private key → download JSON

### Step 3 — Configure `.env.local`
```env
NEXT_PUBLIC_DATA_MODE=firebase
DATA_MODE=firebase
NEXT_PUBLIC_FIREBASE_API_KEY=…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=…
NEXT_PUBLIC_FIREBASE_PROJECT_ID=…
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=…
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
NEXT_PUBLIC_FIREBASE_APP_ID=…

FIREBASE_ADMIN_PROJECT_ID=…
FIREBASE_ADMIN_CLIENT_EMAIL=…
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
```

### Step 4 — Deploy Firestore rules & indexes
```bash
npm install -g firebase-tools
firebase login
firebase use soco-food-truck-finder   # or your project ID
firebase deploy --only firestore
```

This deploys `firestore.rules` and `firestore.indexes.json`.

### Step 5 — Firebase Emulator (optional, for integration tests)
```bash
firebase emulators:start
# Auth on :9099, Firestore on :8080, UI on :4000
```

---

## 9. Admin Authorization — Custom Claims

**The `role` field in `users/{uid}` is for display purposes only. It does NOT control access.**

Admin authority is granted exclusively via Firebase custom claims:

```typescript
// Run this once from a trusted server environment (Cloud Functions, Admin script, etc.)
import { getAuth } from 'firebase-admin/auth';
await getAuth().setCustomUserClaims(uid, { admin: true });
```

After setting the claim, the user must sign out and sign back in for the new token to be issued.

**To revoke admin:**
```typescript
await getAuth().setCustomUserClaims(uid, { admin: false });
// Then revoke existing sessions:
await getAuth().revokeRefreshTokens(uid);
```

**Why custom claims?**
- Firestore document reads can be modified by users with enough access
- Custom claims are server-side only — users cannot write to their own JWT
- `requireAdmin()` calls `verifyIdToken(token, checkRevoked=true)` which validates the signature and checks token revocation

**Firestore rules** also enforce this independently:
```javascript
function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
}
```

---

## 10. Security Architecture

### Server-side route protection (`src/lib/api/require-admin.ts`)

Every `/api/admin/*` route calls `requireAdmin(request)` as the first line:

```typescript
const result = await requireAdmin(request);
if (result instanceof NextResponse) return result;  // 401 or 403
const adminUid = result;  // verified UID — use this for audit logs
```

Response codes:
| Condition | Response |
|---|---|
| No `Authorization` header | 401 |
| Header not `Bearer <token>` | 401 |
| Token invalid / expired | 401 |
| Token revoked / user disabled | 401 |
| Valid token, no `admin` custom claim | 403 |
| Valid token, `admin: true` custom claim | Returns UID string |
| Admin SDK not configured + production | 503 |
| Admin SDK not configured + dev + demo header | Returns `demo-admin-uid` |

### SSRF Protection (`src/lib/api/ssrf-guard.ts`)

All outbound HTTP requests from API routes go through `guardedFetch(url)`:

- Blocks non-`http`/`https` schemes (file, ftp, data, gopher…)
- Blocks embedded credentials (`user:pass@host`)
- Resolves hostname via DNS before connecting
- Blocks resolved IPs in private/reserved ranges:
  - `127.x.x.x` (loopback)
  - `10.x.x.x` (RFC 1918)
  - `172.16–31.x.x` (RFC 1918)
  - `192.168.x.x` (RFC 1918)
  - `169.254.x.x` (link-local / AWS metadata)
  - `::1` (IPv6 loopback)
  - `fc00::/7` (IPv6 unique-local)
- Revalidates every redirect hop against the same rules
- 10-second timeout, 5 MB response size limit

### Firestore rules (`firestore.rules`)

Key invariants enforced at the database level:
- Public reads on `vendors`, `venues`: allowed
- Public reads on `appearances`: only `isPublished=true AND status='scheduled'`
- Public writes: **never**
- Admin writes: only when `request.auth.token.admin == true`
- `users/{uid}` write: user can write **only** their own doc, but `doesNotEscalateRole()` blocks any write that changes the `role` field
- `adminAuditLogs`: no client writes (immutable — written server-side only)

---

## 11. Ingestion Pipeline

### Overview
```
Source URL
  → guardedFetch() — SSRF protected HTTP fetch
  → SHA-256 hash → compare to source.lastContentHash
  → (if unchanged) → return status:'unchanged'
  → node-html-parser → strip scripts/styles/head → plain text
  → extractScheduleCandidates(text, vendorId, sourceId, publicationTime)
  → ExtractionCandidate[] saved to store
  → Admin Review Queue → approve / reject
  → approveCandidate() → creates Appearance with isPublished=true
```

### Schedule Extractor (`src/lib/ingestion/schedule-extractor.ts`)

**This is a heuristic regex-based parser — not an LLM.** It:
- Matches patterns like "Friday at HenHouse from 4pm to 8pm"
- Resolves relative days (`Friday`, `Tomorrow`, `Tonight`) against the **source publication timestamp** in `America/Los_Angeles` timezone
- Returns `{ candidates: ExtractionCandidate[], observationIds: string[] }` — IDs are generated with `crypto.randomUUID()` and are linked for provenance tracking
- Lowers confidence and adds warnings when publication time is unavailable
- Attempts venue alias matching against known venues

### Content-hash deduplication
Each source stores `lastContentHash` (SHA-256 of fetched body). If a re-fetch returns the same hash, extraction is skipped entirely and `status: 'unchanged'` is returned. This prevents duplicate candidates from repeated polling.

### Observation ID provenance
Every `ExtractionCandidate` carries an `observationIds[]` array. When a candidate is approved, the created `Appearance` inherits the same `observationIds[]`, creating a traceable link from public schedule → extraction candidate → raw source fetch.

---

## 12. Map Architecture

### Component: `src/components/MapLibreMap.tsx`

- Uses **MapLibre GL JS** (open-source, no API key required for rendering)
- Default tile provider: **CARTO Positron** (configurable via `NEXT_PUBLIC_MAP_TILE_URL`)
- `data-map-ready` attribute lifecycle:
  - Starts as `"false"` (React initial state)
  - Set to `"true"` inside `map.on('load')` (fired after style is downloaded)
  - Set to `"fallback"` after 8-second safety timer if `load` hasn't fired (e.g. tile server unreachable in CI)
- `flyTo()` is only called when `map.loaded()` returns true; otherwise the target is queued in `pendingFlyToRef` and executed in the `load` handler
- `ResizeObserver` calls `map.resize()` when the container dimensions change (handles mobile tab switching)
- Error boundary: if WebGL context fails, renders a text fallback with a retry button

### Marker → Card sync
Clicking a map marker calls `onSelectAppearance(id)` → sets `selectedAppearanceId` in page state → highlights the matching `VendorCard` with `border-amber-500` class.

### Card → Marker sync  
Clicking a `VendorCard` calls `onSelectAppearance(id)` → updates `selectedAppearanceId` → the `useEffect` in `MapLibreMap` detects the change → calls `map.flyTo()` and opens the popup on the corresponding marker.

---

## 13. Running Tests

### Unit tests (Vitest)
```bash
npm test
# or
npx vitest run
```

**39 tests across 2 files:**
- `tests/domain.test.ts` — timezone helpers, `isCurrentlyOpen()`, venue alias matching, favourite merging
- `tests/repair-acceptance.test.ts` — `requireAdmin` (401/403/200), SSRF guard (11 cases), schedule extractor (provenance, UUID format, timezone), filter correctness

### E2E tests (Playwright)
```bash
# Requires dev server running on :3000
npm run dev &
npx playwright test
```

**6 tests across 3 files (chromium + Mobile Chrome):**
- `admin-review-queue.spec.ts` — demo admin login → fetch source → approve candidate → verify public appearance
- `core-discovery-flow.spec.ts` — homepage load → map ready → canvas dimensions → filters → vendor profile → venue page → favourites persistence
- `mobile-map-flow.spec.ts` — mobile viewport → map/list toggle → canvas check → screenshot capture

Screenshots saved to `audit/2026-09-07/screenshots/`.

### Build check
```bash
npm run build
```
Should complete with 0 TypeScript errors and 15 routes.

---

## 14. Deployment

### Vercel (recommended)
```bash
npm install -g vercel
vercel --prod
```
Set all environment variables in Vercel dashboard → Project → Settings → Environment Variables. Firebase Admin private key: paste the full PEM string with literal `\n` newlines.

### Environment checklist for production
- [ ] `NODE_ENV=production` (set automatically by build tools)
- [ ] `NEXT_PUBLIC_DATA_MODE=firebase`
- [ ] `DATA_MODE=firebase`
- [ ] All `NEXT_PUBLIC_FIREBASE_*` client SDK vars
- [ ] All `FIREBASE_ADMIN_*` server SDK vars
- [ ] `GEOCODING_API_URL` pointed at a paid/self-hosted Nominatim instance
- [ ] `SSRF_ALLOWED_DOMAINS` set to a comma-separated allowlist of permitted source domains
- [ ] Firestore rules deployed: `firebase deploy --only firestore`
- [ ] At least one admin user with custom claim: `setCustomUserClaims(uid, { admin: true })`

---

## 15. Known Gaps & Next Steps

| Item | Priority | Notes |
|---|---|---|
| Firebase emulator integration tests | P1 | `tests/integration/` directory ready; needs `firebase-tools` CLI and test runner config |
| Firestore server-side filtering | P2 | `firestore-store.ts` fetches then filters in memory for city/cuisine; should use Firestore `where` clauses with composite indexes |
| Instagram ingestion | P2 | Currently records `status: 'restricted'`; no workaround without official API |
| Notification system | P3 | `NotificationPreference` type defined; no delivery implementation |
| Menu management UI | P3 | `Menu` and `MenuItem` types defined; no admin UI yet |
| Rate limiting on API routes | P2 | No per-IP rate limiting on `/api/admin/*`; recommend adding middleware or edge config |
| Admin user management UI | P2 | Custom claims must be set via script/console; no in-app UI |
| Audit log UI | P3 | `AdminAuditLog` type defined and written to; `/admin/audit` page exists but read-only |

---

## 16. Agent & LLM Handoff Notes

> This section is written for AI coding agents (Antigravity, Claude, Gemini, Copilot, etc.) continuing work on this repository.

### What is real vs. demo

| Thing | Status |
|---|---|
| Firebase/Firestore persistence | **Real** — works when Firebase env vars are configured |
| Firebase Authentication | **Real** — works in Firebase mode |
| Admin authorization (custom claims) | **Real** — `require-admin.ts` enforces this server-side |
| SSRF protection | **Real** — DNS resolution + IP range checks implemented |
| Schedule extractor | **Real heuristic parser** — regex-based, NOT an LLM |
| Demo seed data | **Fictional** — vendors/venues/appearances are invented for development |
| Firebase emulator integration tests | **Skeleton only** — directory and config exist, tests not yet written |

### Authorization rules (non-negotiable)

1. **Admin authority = Firebase custom claim `admin: true` only.** `profile.role` in Firestore is display-only.
2. **Never derive admin UID from client request body.** Use `decoded.uid` from the verified token.
3. **Demo admin is only available in `NODE_ENV !== 'production'`.** Do not change this.
4. **All `/api/admin/*` routes must call `requireAdmin(request)` as their first line.**

### Key files for any new feature

| Task | File to modify |
|---|---|
| Add a new domain type | `src/types/index.ts` |
| Add a new store method (both modes) | `src/lib/db/store.ts` + `src/lib/db/firestore-store.ts` |
| Add a new admin API route | `src/app/api/admin/<name>/route.ts` — always call `requireAdmin` first |
| Add seed data for demo mode | `src/lib/seed/sonoma-seed.ts` |
| Change map behaviour | `src/components/MapLibreMap.tsx` |
| Change timezone logic | `src/lib/timezone/index.ts` |
| Change app-level constants | `src/config/app-config.ts` |

### Coding conventions

- All dates stored as `YYYY-MM-DD` strings in `America/Los_Angeles` timezone
- All times stored as `HH:mm` strings (24-hour), no timezone suffix
- `crypto.randomUUID()` for all new persistent IDs — never `Date.now()` as an ID
- TypeScript strict mode — no `any` except where explicitly cast and commented
- Server components for data fetching, client components only when browser APIs needed
- `adminFetch()` for all client-side calls to `/api/admin/*` — it injects the Bearer token automatically

### Test before committing

```bash
npx tsc --noEmit          # must be 0 errors
npx vitest run            # must be 39/39
npm run build             # must be clean
npx playwright test       # must be 6/6 (requires dev server on :3000)
```
