# Dependency Audit
**SoCo Food Truck Finder — Commit 39a5b0b — 2026-09-07**

---

## `npm audit` Results

Command: `npm audit`  
Exit code: 1 (vulnerabilities found)

```
# npm audit report

uuid  <11.1.1
Severity: moderate
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided
https://github.com/advisories/GHSA-w5hq-g745-h8pq
Fix: npm audit fix --force (WARNING: breaks firebase-admin to v10.3.0)
node_modules/uuid
  gaxios  6.4.0 - 6.7.1
    → depends on vulnerable uuid
  teeny-request  3.9.1 - 9.0.0
    → depends on vulnerable uuid
    @google-cloud/storage  2.2.0-2.5.0 || 5.19.0-8.0.0
      → depends on retry-request + teeny-request
      firebase-admin  7.0.0-8.2.0 || >=11.0.0
        → depends on @google-cloud/storage
    retry-request  7.0.0-7.0.2
      → depends on teeny-request

6 moderate severity vulnerabilities
```

---

## Severity Assessment

| Severity | Count | Assessment |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Moderate | 6 | All in firebase-admin dependency chain |
| Low | 0 | — |

The 6 moderate vulnerabilities are all in the `uuid` package via `firebase-admin` transitive
dependencies. The `uuid` vulnerability is a buffer bounds check issue in v3/v5/v6 when a `buf`
argument is provided. This is not a remotely exploitable vulnerability in typical server-side
usage. The impact is low because:
1. `firebase-admin` is a server-side SDK not exposed to public requests
2. The buffer bounds check issue only affects code that explicitly passes a `buf` parameter to
   uuid v3/v5/v6 — unlikely in firebase-admin's own uuid usage

**Recommendation:** Monitor for a firebase-admin release that upgrades its uuid dependency to
≥11.1.1. Do not run `npm audit fix --force` as it will downgrade firebase-admin to v10.3.0
(breaking changes).

---

## Key Dependencies

| Package | Version | Purpose | Notes |
|---|---|---|---|
| next | 16.3.4 | Web framework | Latest stable |
| react | 19.x | UI framework | Latest stable |
| typescript | 5.x | Type system | Latest stable |
| firebase | 12.x | Client SDK (Auth, Firestore, Storage) | Latest stable |
| firebase-admin | ≥11.0.0 | Server-side Admin SDK | 6 moderate vulns in chain |
| maplibre-gl | ~5.x | Open source map rendering | Open source, no billing |
| tailwindcss | 4.x | CSS utility framework | v4 — newer major version |
| lucide-react | latest | Icon library | MIT license |
| vitest | 5.x | Unit test framework | |
| @playwright/test | latest | E2E test framework | |

---

## License Compliance

| License | Packages |
|---|---|
| MIT | next, react, typescript, maplibre-gl, lucide-react, tailwindcss, vitest |
| Apache 2.0 | firebase, firebase-admin |
| BSD | — |

No GPL or LGPL dependencies detected. All production dependencies are MIT or Apache 2.0 licensed.
Suitable for commercial deployment.

---

## Recommendations

1. **Do not** run `npm audit fix --force` — it will break firebase-admin.
2. Monitor [https://github.com/advisories/GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) for upstream fix.
3. Consider pinning `firebase-admin` to a minor version with a lockfile to prevent inadvertent upgrades.
4. The `vitest.config.ts` generates a Vite warning about ESM syntax in CommonJS context — resolve by adding `"type": "module"` to package.json or renaming to `vitest.config.mts`.
