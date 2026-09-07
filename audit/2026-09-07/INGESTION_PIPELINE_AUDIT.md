# Ingestion Pipeline Audit
**SoCo Food Truck Finder — Commit 39a5b0b — 2026-09-07**

---

## Overall Grade: **B-**

The pipeline architecture is sound: source → fetch → normalize → extract → candidate → review →
appearance. The HTTP fetch layer works correctly with proper error handling. The critical gap is
that the extractor is described as "AI" but is actually a regex/heuristic parser — not an LLM.
The pipeline also lacks authentication, deduplication, and content-change detection.

---

## Pipeline Architecture

```
Source (configured URL)
    ↓
POST /api/admin/sources/fetch
    ↓
Server-side HTTP fetch (node-fetch via Next.js runtime)
    ↓ [Instagram] → restricted status (403 fallback)
    ↓ [Other] → responseText
    ↓
HTML stripping (regex)
    ↓
extractScheduleCandidates() — heuristic text parser
    ↓
ExtractionCandidate[] saved to store
    ↓
Observation[] saved to store (one per candidate)
    ↓
Admin Review Queue (/admin/review-queue)
    ↓
approveCandidate() → Appearance (published=true)
```

---

## Findings

### 🟠 P1 — HIGH: "AI Extractor" is Heuristic-Only, Not an LLM

**File:** `src/lib/ingestion/ai-extractor.ts`  
**Evidence:** The file is named `ai-extractor.ts` and is referenced as an "AI text schedule
extraction parser" in the file comment (line 13). However, the implementation uses only
regex patterns:

```ts
// Detect Day of Week
const dayMatch = text.match(/\b(Monday|Tuesday|...)\b/i);

// Detect Time Range
const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?...)/i);

// Detect Venue Name
const venueMatch = text.match(/\bat\s+([A-Za-z0-9\s'–()-]+?)(?=\s+from|...)/i);
```

There is no call to any LLM API (OpenAI, Anthropic, Vertex AI, Gemini, etc.). The extraction
is entirely pattern-based and will fail on natural language schedule posts that don't follow
these exact patterns (e.g., "Swinging by Cooperage for their evening rotation" or "We'll be
at the usual spot Saturday!").

**Impact:** The review queue will frequently surface low-quality or empty candidates for
ambiguously worded social media posts, requiring more manual admin effort.

**Fix:**  
- **Short-term:** Rename `ai-extractor.ts` to `heuristic-extractor.ts` or `schedule-parser.ts`
  to accurately reflect the implementation.
- **Long-term:** Add optional LLM fallback for low-confidence extractions using an API key
  (e.g., Gemini API, which is already an available service in this environment).

---

### 🟠 P1 — HIGH: No Authentication Check on `/api/admin/sources/fetch`

**File:** `src/app/api/admin/sources/fetch/route.ts`, line 13  
**Evidence:** (See SECURITY_AUDIT.md — P0 finding)

Any public request to this endpoint triggers a server-side URL fetch. Repeated calls could
exhaust the Nominatim rate limit or be used to port-scan internal services (SSRF).

---

### 🟡 P2 — MEDIUM: No Content Deduplication — Same Content Re-Extracted Every Run

**File:** `src/app/api/admin/sources/fetch/route.ts`, lines 116–150  
**Evidence:**

The pipeline computes a `contentHash` (line 117) and saves it in the `SourceFetch` record,
but never compares it to the previous fetch's hash:

```ts
const contentHash = crypto.createHash('sha256').update(responseText).digest('hex');

const fetchRecord: SourceFetch = {
  ...
  contentHash,    // saved but never compared to previous fetch
  ...
};
```

If an admin clicks "Check Now" on the same source twice, the same content will be extracted
twice, creating duplicate ExtractionCandidates pointing to the same schedule dates with identical
raw text.

**Fix:** Before extraction, query the last `SourceFetch` for this source and compare hashes.
Skip extraction if hash is unchanged. Log a "no change detected" result.

---

### 🟡 P2 — MEDIUM: HTML Normalization Uses Regex HTML Parsing (Fragile)

**File:** `src/app/api/admin/sources/fetch/route.ts`, lines 136–141  
**Evidence:**

```ts
const normalizedText = responseText
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
```

Regex HTML parsing has known failure modes (e.g., tags containing `>` in attribute values,
nested script tags, HTML entities). This can cause schedule-containing text to be corrupted
before extraction, reducing the quality of candidates.

**Fix:** Use a proper HTML parser. In a Node.js API route context, `node-html-parser` or
`cheerio` are appropriate and lightweight. `JSDOM` is heavier but more complete.

---

### 🟡 P2 — MEDIUM: `vendorId` Defaults to `'vendor-galvans-demo'` for Unmatched Sources

**File:** `src/app/api/admin/sources/fetch/route.ts`, line 146  
**Evidence:**

```ts
const candidates = await extractScheduleCandidates({
  sourceId: source.id,
  vendorId: source.entityId || 'vendor-galvans-demo',  // <-- fallback to hardcoded demo vendor
  rawText: normalizedText.length > 5 ? normalizedText : responseText,
  ...
});
```

If `source.entityId` is null/empty, extraction candidates will be attributed to
`vendor-galvans-demo`. This would create incorrect Appearances for the wrong vendor.

**Fix:** Validate that `source.entityId` is set and non-empty before proceeding. Return a
validation error if the source has no associated entity.

---

### 🟡 P2 — MEDIUM: Observation Records Do Not Reference `fetchId` Correctly

**File:** `src/app/api/admin/sources/fetch/route.ts`, lines 154–168  
**Evidence:**

```ts
for (const cand of candidates) {
  await saveCandidate(cand);
  const obs: Observation = {
    id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sourceId: source.id,
    fetchId,
    vendorId: cand.vendorId,
    venueText: cand.proposedVenueText,
    ...
  };
  await saveObservation(obs);
}
```

The observation `id` and the candidate `observationIds[0]` (set in `ai-extractor.ts`, line 118:
`const obsId = 'obs-${Date.now()}-${i}'`) are generated at different times and by different
code paths. The `obsId` generated in the extractor (e.g., `obs-1725715200000-0`) will not match
the observation actually saved by the route (e.g., `obs-1725715200100-a3b2`). The provenance
link `candidate.observationIds` is therefore broken.

**Fix:** Generate observation IDs in the route handler and pass them back to the candidates,
or generate them in the extractor and pass them to the route handler for saving.

---

### 🟢 P3 — LOW: Candidate IDs May Collide Within Same Millisecond

**File:** `src/lib/ingestion/ai-extractor.ts`, line 117  
**Evidence:**

```ts
const candidateId = `cand-extracted-${Date.now()}-${i}`;
```

Within a single extraction run, the `Date.now()` value is likely identical for all candidates
(the loop runs synchronously). The `i` suffix prevents collisions within one run, but a rapid
sequence of extraction runs in the same millisecond could produce duplicate IDs.

**Fix:** Add UUID or stronger entropy: `crypto.randomUUID()` or import from `uuid`.

---

### 🟢 P3 — LOW: `resolveRelativeDayOfWeek()` Uses `new Date()` (Server Clock, Not LA Timezone)

**File:** `src/lib/ingestion/ai-extractor.ts`, lines 145–165  
**Evidence:**

```ts
function resolveRelativeDayOfWeek(dayName: string): string {
  const d = new Date();
  const currentDay = d.getDay();
  let diff = targetDay - currentDay;
  ...
  return getDateLA(diff);
}
```

`d.getDay()` returns the day-of-week in the **server's local timezone** (UTC on most cloud hosts),
not in `America/Los_Angeles`. This can produce off-by-one errors for dates. The final `getDateLA(diff)`
call correctly converts to LA date, but `diff` was computed with UTC days.

**Fix:** Compute `currentDay` using an LA-timezone date formatter, not `d.getDay()`.

---

## Verified Correctly Implemented

- ✅ Instagram sources return `restricted` status without attempting to scrape (correct behavior)
- ✅ 10-second timeout prevents hanging on slow sources
- ✅ Failed HTTP fetches are recorded as `SourceFetch` with `status: 'failed'`
- ✅ Source `lastCheckedAt` / `lastSuccessfulAt` / `lastError` are updated correctly
- ✅ `rawPayload` limited to 10,000 chars to prevent storage bloat
- ✅ Content hash computed using SHA-256 (strong, appropriate)
- ✅ Venue alias matching is called for each extracted candidate
- ✅ `hasConflicts` flag correctly detected via overlap comparison with existing appearances
- ✅ `confidenceScore` adjusted downward for unmatched venues, missing times, conflicts
- ✅ Candidates with neither venue nor time match are skipped (line 75)
- ✅ `approveCandidate()` correctly creates an `Appearance` and optionally registers venue alias
