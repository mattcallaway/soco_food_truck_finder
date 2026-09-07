# SoCo Food Truck Finder — Comprehensive Audit Report
**Date:** 2026-09-07  
**Auditor:** Antigravity — Independent senior software / security / QA review  
**Commit SHA:** `39a5b0b`  
**Branch:** main  
**Mode Tested:** `DATA_MODE=demo` (in-memory, no Firebase credentials)  

---

## Summary

This is the master index for the audit. Individual report files cover each domain.

| Report File | Domain | Overall Grade |
|---|---|---|
| SECURITY_AUDIT.md | Security & Auth | B |
| DATA_PERSISTENCE_AUDIT.md | Persistence & DAL | B+ |
| MAP_AUDIT.md | Map & Geospatial | B |
| INGESTION_PIPELINE_AUDIT.md | Ingestion & Extraction | B- |
| FRONTEND_AUDIT.md | Frontend & UX | A- |
| FUNCTIONALITY_MATRIX.md | Feature Functionality Matrix | — |
| REPAIR_PLAN.md | Prioritized Repair Items | — |

---

## Baseline Verification Results

| Check | Result | Evidence |
|---|---|---|
| `npm run build` | ✅ PASS | Exit 0, 14 routes built, no TS errors |
| `npx vitest run` | ✅ PASS | 10/10 tests, 494ms |
| `npx playwright test` | ✅ PASS | 6/6 E2E tests, 20.1s |
| `npm audit` | ⚠️ MODERATE | 6 moderate vulnerabilities in uuid→firebase-admin chain |
| Git status | ✅ CLEAN | 2 commits, no pending changes to tracked files |

---

## Key Risk Areas Identified

1. **Admin protection is client-side only.** API routes have no server-side auth middleware. Any request to `/api/admin/sources/fetch` can succeed from the public internet with no authentication check.

2. **Demo admin bypass is never disabled in production** — `toggleDemoAdmin()` sets `soco_demo_admin=true` in `localStorage`, and `AuthContext` respects this even when `hasLiveFirebaseConfig()` returns true.

3. **Geocoding and ingestion route are unauthenticated** — `/api/admin/geocode` and `/api/admin/sources/fetch` do not check the caller's identity. No middleware, no session cookie, no Bearer token validation.

4. **In-memory filter logic in `applyAppearanceFilters()` reads from global `memoryVendors` / `memoryVenues` directly** — this will return stale/incorrect data in Firestore mode because the filter joins are not re-queried from Firestore.

5. **Map tiles and geocoding default to public Nominatim & CARTO** — acceptable for development but these providers have strict rate limits and are unsuitable for production load.

6. **`admin-seed-uid` is hardcoded** in memory state — user with uid `admin-seed-uid` in demo mode is hardcoded as an admin profile.

7. **`addAuditLog()` calls pass `adminUserId: 'admin-user'` (literal string)** instead of the actual authenticated user's UID.

8. **No CSRF protection on POST routes** — Next.js API routes do not automatically protect against cross-site request forgery.

---

## Evidence Summary by Feature

| Feature | Code Present | Verified Working | Notes |
|---|---|---|---|
| Public discovery page | ✅ | ✅ | Demo data renders correctly |
| Vendor profile pages | ✅ | ✅ | Dynamic route `/vendors/[slug]` |
| Venue profile pages | ✅ | ✅ | Dynamic route `/venues/[slug]` |
| Favorites (anonymous) | ✅ | ✅ | localStorage-backed, merge on sign-in |
| MapLibre map | ✅ | ✅ (partial) | Markers render but tests use DOM-only assertions |
| Appearance filters (date/city/cuisine) | ✅ | ✅ | Demo mode only; Firestore mode untested |
| Firebase Firestore persistence | ✅ CODE | ❌ NOT RUNTIME TESTED | No credentials; all paths untested in browser |
| Firebase Auth — Google Sign-In | ✅ CODE | ❌ NOT RUNTIME TESTED | No credentials |
| Firebase Auth — Email Link | ✅ CODE | ❌ NOT RUNTIME TESTED | No credentials |
| Admin protection — UI guard | ✅ | ✅ | `isAdmin` check in layout.tsx |
| Admin protection — API layer | ❌ MISSING | ❌ NOT IMPLEMENTED | No server-side auth on API routes |
| Source ingestion pipeline | ✅ | ✅ (partial) | HTTP fetch works; AI extractor is heuristic-only |
| Source fetch — Instagram | ✅ | ✅ | Correctly returns 403 restricted |
| Schedule extraction candidates | ✅ | ✅ | Heuristic text parser — not LLM |
| Review queue — approve | ✅ | ✅ | Promotes candidate → Appearance |
| Geocoding — server-side API | ✅ | ✅ (partial) | Calls Nominatim; no auth guard |
| Audit log writes | ✅ | ⚠️ PARTIAL | `adminUserId` hardcoded as `'admin-user'` literal |
| Firestore security rules | ✅ | ❌ NOT DEPLOYED | Rules file exists but deployment unverified |

---

## Audit Scope

This audit was performed as a white-box inspection of source code at commit `39a5b0b`, supplemented by:
- Automated `vitest` unit tests (10 tests, all passing)
- Playwright E2E browser tests (6 tests, all passing against demo mode)
- Static analysis and security review of all source files
- `npm audit` dependency scan
- Code-level evidence review for all findings (no finding is assumption-only)

---

## Legend

| Status | Meaning |
|---|---|
| VERIFIED WORKING | Observed working at runtime |
| PARTIAL | Working in some modes/conditions |
| SCAFFOLDED | Code present, full function not implemented |
| MOCKED | Returns hardcoded/demo data |
| BROKEN | Present but fails at runtime |
| MISSING | Not implemented |
| NOT TESTABLE | Requires external service not available |
