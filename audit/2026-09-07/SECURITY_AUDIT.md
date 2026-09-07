# Security Audit
**SoCo Food Truck Finder — Commit 39a5b0b — 2026-09-07**

---

## Overall Security Grade: **B**

The application has strong client-side authentication guards and correct Firestore security rules
in the rules file. However, the API layer is entirely unprotected server-side — any unauthenticated
request to admin API routes will succeed. This is the most significant security gap.

---

## Findings

### 🔴 P0 — CRITICAL: No Server-Side Authentication on Admin API Routes

**File:** `src/app/api/admin/sources/fetch/route.ts`  
**File:** `src/app/api/admin/geocode/route.ts`  
**Evidence:**

```ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId } = body;
    // No auth check. No session verification. No Firebase ID token validation.
    const sources = await getSources();
    ...
```

Neither API route verifies the caller's identity. A public internet request to:
`POST /api/admin/sources/fetch` with `{"sourceId": "source-galvans-insta-demo"}`
will execute the full ingestion pipeline (fetch external URL, write to database, create extraction
candidates) regardless of whether the requester is an administrator.

**Impact:** Unauthenticated actors can trigger URL fetches, write ExtractionCandidates to the
database, and invoke the geocoding API without any authorization. In Firestore mode, the writes
would be blocked by Firestore security rules, but geocoding (server-to-server) has no such protection.

**Fix:** Add Firebase ID token verification middleware using `firebase-admin` SDK. Verify
`Authorization: Bearer <idToken>` header or a session cookie on every admin API route.

---

### 🔴 P0 — CRITICAL: Demo Admin Toggle is a Security Bypass Mechanism in Production

**File:** `src/context/AuthContext.tsx`, lines 137–154  
**Evidence:**

```ts
const toggleDemoAdmin = () => {
  const next = !isAdmin;
  setIsAdmin(next);
  if (next) {
    localStorage.setItem('soco_demo_admin', 'true');
    setUserProfile({ uid: 'admin-seed-uid', role: 'admin', ... });
  }
};
```

And on mount (lines 49–63):
```ts
if (!hasLiveFirebaseConfig() || !auth) {
  const demoAdminActive = localStorage.getItem('soco_demo_admin') === 'true';
  if (demoAdminActive) setIsAdmin(true);
  ...
}
```

The demo admin bypass only activates when `!hasLiveFirebaseConfig()`. This is correctly gated.
However, because the admin API routes are unprotected (see P0 above), even if this localStorage
bypass is set by a user who manually calls `localStorage.setItem('soco_demo_admin','true')` and
then calls the API routes directly, the API will still respond without checking.

Additionally, the `toggleDemoAdmin` function is exposed in the AuthContext value object, meaning
any component can call it. The admin login page likely exposes this to users.

**Fix:** Remove `toggleDemoAdmin` from production builds or gate it behind `process.env.NODE_ENV === 'development'`.

---

### 🟠 P1 — HIGH: Firestore Security Rules File Present but Deployment Unverified

**File:** `firestore.rules`  
**Evidence:** The rules file exists and contains correct access controls for all collections.
However, there is no evidence of deployment (no `firebase.json` or `.firebaserc` configuration,
no CI/CD pipeline that runs `firebase deploy --only firestore:rules`).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && (
        request.auth.token.admin == true ||
        get(...users/$(request.auth.uid)...).data.role == 'admin'
      );
    }
    ...
```

The rules themselves are well-designed: vendors/venues/menus are publicly readable, appearances
enforce `isPublished == true` for public readers, and all admin/ingestion collections are admin-only.

**Risk:** If `firestore.rules` has never been deployed to the Firebase project, the live Firestore
instance uses permissive default rules, exposing all data to public read/write.

**Fix:** Add `firebase.json` and `.firebaserc`, and document or automate deployment of security rules.

---

### 🟠 P1 — HIGH: Admin isAdmin Determination Trusts Firestore Profile Without Custom Claims

**File:** `src/context/AuthContext.tsx`, lines 86–90  
**Evidence:**

```ts
const idTokenResult = await fbUser.getIdTokenResult();
const hasAdminClaim = Boolean(idTokenResult.claims.admin);
const isRoleAdmin = profile.role === 'admin';
setIsAdmin(hasAdminClaim || isRoleAdmin);
```

The code reads `profile.role` from Firestore (the `users/{uid}` document). A user who can write
to their own `users/{uid}` document could set `role: 'admin'` and gain admin access. The Firestore
rules for `/users/{userId}` allow:

```
allow read, write: if request.auth != null && request.auth.uid == userId;
```

This means any authenticated user can set their own `role` to `'admin'` in Firestore.

**Fix:** Remove `isRoleAdmin` as an admin check. Admin status should be determined exclusively by
Firebase custom claims (`request.auth.token.admin == true`), set server-side by an administrator
using `firebase-admin`. Alternatively, restrict the `role` field from being self-writable via
Firestore rules (e.g., `allow update: if ... && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])`).

---

### 🟡 P2 — MEDIUM: Audit Log adminUserId is Hardcoded

**File:** `src/app/admin/sources/page.tsx`, lines 45–51  
**File:** `src/app/admin/venues/page.tsx`, lines 103–109  
**Evidence:**

```ts
await addAuditLog({
  adminUserId: 'admin-user',  // BUG: hardcoded literal, not the actual user's UID
  action: 'check_source_now',
  ...
});
```

Every audit log entry records the adminUserId as the literal string `'admin-user'` rather than the
authenticated user's actual Firebase UID. This makes the audit log useless for accountability.

**Fix:** Pass the authenticated user's UID from `useAuth().user?.uid` into `addAuditLog()`.

---

### 🟡 P2 — MEDIUM: No CSRF Protection on API Routes

**File:** All files under `src/app/api/`  
**Evidence:** Next.js App Router does not add CSRF protection automatically. All API routes
accept POST requests from any origin with no origin verification.

**Impact:** Any malicious website could trigger admin actions against a logged-in admin user's
session if cookies are used for session management.

**Fix:** Add a `SameSite=Strict` cookie policy and/or verify the `Origin` header in admin routes.
Since Firebase uses Bearer token auth (not cookies), this is mitigated somewhat but not eliminated.

---

### 🟡 P2 — MEDIUM: User-Controlled URL Fetched Server-Side Without Allowlist

**File:** `src/app/api/admin/sources/fetch/route.ts`, lines 71–77  
**Evidence:**

```ts
const res = await fetch(source.url, {
  headers: { 'User-Agent': 'SoCo-Food-Truck-Finder-Bot/1.0' },
  signal: controller.signal,
});
```

The `source.url` value comes from the database. Any URL stored in the `sources` collection will
be fetched server-side. There is no allowlist of permitted domains, no rejection of `file://`,
`localhost`, internal IP addresses, or other SSRF vectors.

**Impact (SSRF risk):** If an attacker can write to the `sources` collection (which requires admin
access, so risk is lower), they could fetch internal metadata endpoints (e.g., `http://169.254.169.254/`
on cloud platforms).

**Fix:** Validate `source.url` against an allowlist of known domains or at minimum enforce
`https://` scheme and reject RFC-1918 IP ranges before fetching.

---

### 🟢 P3 — LOW: Content Hash of Source Fetch Not Compared to Previous Fetch

**File:** `src/app/api/admin/sources/fetch/route.ts`, line 117  
**Evidence:**

```ts
const contentHash = crypto.createHash('sha256').update(responseText).digest('hex');
```

The content hash is computed and saved in the `SourceFetch` record, but it is never compared to
the previous fetch's hash to detect whether the content has changed. Every fetch generates new
candidates even if the source content is identical.

**Fix:** Before running extraction, retrieve the last successful SourceFetch and compare hashes.
Skip extraction if the content hash is unchanged.

---

## Verified Correctly Implemented

- ✅ `checkProductionSafety()` prevents in-memory fallback in `NODE_ENV=production`
- ✅ Firestore rules enforce `isPublished == true` for public appearance reads
- ✅ Admin UI layout redirects to `/admin/login` for non-admin users  
- ✅ `hasLiveFirebaseConfig()` gate prevents Firebase initialization without credentials
- ✅ Instagram sources correctly return `restricted` instead of attempting login-walled fetch
- ✅ `auth = null` guard prevents auth operations when Firebase is not configured
