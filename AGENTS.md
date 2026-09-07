# SoCo Food Truck Finder — Agent Context
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

## Project Identity

**SoCo Food Truck Finder** — a production-quality full-stack web application for discovering scheduled mobile food vendors (food trucks, trailers, carts, pop-ups, taco stands) throughout Sonoma County, California.

**GitHub:** https://github.com/mattcallaway/soco_food_truck_finder  
**Stack:** Next.js 16 · React 19 · TypeScript 6 · Tailwind CSS 4 · MapLibre GL 6 · Firebase/Firestore · Vitest 5 · Playwright 1.50

---

## Key Docs to Read First

| Document | Purpose |
|---|---|
| [README.md](README.md) | Full setup, architecture overview, deployment checklist, agent handoff notes |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Deep-dive internal design decisions, data contracts, security rules logic |
| [src/types/index.ts](src/types/index.ts) | **Canonical domain model** — all interfaces live here |
| [src/lib/db/store.ts](src/lib/db/store.ts) | **Unified repository façade** — all data access goes through here |
| [REPAIR_PLAN.md](REPAIR_PLAN.md) | Post-audit task list — describes what was fixed and what remains |

---

## Absolute Rules (Non-Negotiable)

### Authorization
1. **Admin authority = Firebase custom claim `admin: true` ONLY.**  
   `profile.role` in Firestore is display-only. Never derive admin from it.
2. **Every `/api/admin/*` route must call `requireAdmin(request)` as its first statement.**  
   Pattern: `const result = await requireAdmin(request); if (result instanceof NextResponse) return result; const adminUid = result;`
3. **Never derive the acting admin UID from client-supplied data.**  
   Use `decoded.uid` from the verified token.
4. **Demo admin is only available when `NODE_ENV !== 'production'`.**  
   Do not weaken or remove this gate.

### Data Safety
5. **`getPublicAppearances()` only — never `getAdminAppearances()` — on public routes.**  
   Public appearances must have `isPublished=true AND status='scheduled'`.
6. **All dates stored as `YYYY-MM-DD` in `America/Los_Angeles` timezone.**  
   All times stored as `HH:mm` 24-hour, no timezone suffix.
7. **Use `crypto.randomUUID()` for all new persistent IDs.** Never `Date.now()` as an ID.
8. **Demo seed data is fictional.** Never invent real business schedules or attributes.

### Testing
9. **Before committing: `npx tsc --noEmit` (0 errors) + `npx vitest run` (39/39) + `npm run build` (clean).**

---

## Architecture at a Glance

```
src/lib/db/store.ts          ← ALL data access. Do not bypass this.
  ├── DATA_MODE=firebase      → src/lib/db/firestore-store.ts
  └── DATA_MODE=demo          → src/lib/seed/sonoma-seed.ts (in-memory)

src/lib/api/require-admin.ts ← Server: verifies Firebase token + admin custom claim
src/lib/api/ssrf-guard.ts    ← Server: DNS + IP range + redirect SSRF protection
src/lib/api/admin-fetch.ts   ← Client: auto-injects Bearer token for admin API calls
src/lib/firebase/admin-config.ts ← Server-side Firebase Admin SDK (NEVER import client-side)
src/lib/firebase/config.ts       ← Client-side Firebase JS SDK

src/lib/ingestion/schedule-extractor.ts ← Heuristic regex parser (NOT an LLM)
src/lib/timezone/index.ts               ← getDateLA(offset, refDate?), formatTimeDisplay, isCurrentlyOpen
src/config/app-config.ts                ← APP_CONFIG, SONOMA_CITIES, CUISINE_TAXONOMY
src/types/index.ts                      ← All domain interfaces
```

## File to Change Matrix

| Task | File(s) |
|---|---|
| New domain type/interface | `src/types/index.ts` |
| New store method | `src/lib/db/store.ts` + `src/lib/db/firestore-store.ts` |
| New admin API route | `src/app/api/admin/<name>/route.ts` — `requireAdmin` first |
| New public page | `src/app/<path>/page.tsx` — use `getPublicAppearances` only |
| New seed data | `src/lib/seed/sonoma-seed.ts` |
| Map changes | `src/components/MapLibreMap.tsx` |
| Timezone helpers | `src/lib/timezone/index.ts` |
| Constants/taxonomies | `src/config/app-config.ts` |
| Security rules | `firestore.rules` + deploy with `firebase deploy --only firestore:rules` |
| Firestore indexes | `firestore.indexes.json` + deploy with `firebase deploy --only firestore:indexes` |

---

## Current Test State (commit fdb8db7)

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx vitest run` | ✅ 39/39 |
| `npm run build` | ✅ clean, 15 routes |
| `npx playwright test` | ✅ 6/6 (chromium + Mobile Chrome) |

---

## Known Incomplete Areas

| Area | Status |
|---|---|
| Firebase emulator integration tests | Config exists (`firebase.json`, `.firebaserc`); tests not yet written |
| Firestore server-side filtering | `firestore-store.ts` fetches then filters city/cuisine in memory; should use `where()` clauses |
| Rate limiting on admin API routes | Not implemented |
| Admin user management UI | Custom claims must be set via script; no in-app UI |
| Menu management UI | Types defined; no admin page |
| Notification system | Types defined; no delivery implementation |

---

## Local Dev Quick Start

```bash
git clone https://github.com/mattcallaway/soco_food_truck_finder.git
cd soco_food_truck_finder
npm install
cp .env.example .env.local
npm run dev
# Open http://localhost:3000
# Admin: http://localhost:3000/admin/login → enable "Demo Admin" toggle
```

No Firebase account needed for demo mode.
