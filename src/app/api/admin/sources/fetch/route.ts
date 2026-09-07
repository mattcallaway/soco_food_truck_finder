import { NextRequest, NextResponse } from 'next/server';
import {
  getSources,
  saveSource,
  saveSourceFetch,
  saveObservation,
  saveCandidate,
} from '@/lib/db/store';
import { extractScheduleCandidates } from '@/lib/ingestion/schedule-extractor';
import { guardedFetch } from '@/lib/api/ssrf-guard';
import { requireAdmin } from '@/lib/api/require-admin';
import { SourceFetch, Observation } from '@/types';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const adminUid = authResult; // verified UID from Firebase custom claim

  try {
    const body = await request.json();
    const { sourceId } = body;

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
    }

    const sources = await getSources();
    const source = sources.find((s) => s.id === sourceId);

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const fetchId = `fetch-${crypto.randomUUID()}`;
    const startedAt = new Date().toISOString();

    // ── Instagram: restricted – log and return ──────────────────────────────
    if (source.sourceType === 'instagram') {
      const fetchRecord: SourceFetch = {
        id: fetchId,
        sourceId: source.id,
        fetchedAt: startedAt,
        status: 'restricted',
        httpStatus: 403,
        contentType: 'text/html',
        effectiveUrl: source.url,
        errorMessage:
          'Instagram data access restricted (login wall). Preserving manual and alternative schedule sources.',
        rawPayload: '<!-- Instagram Login Wall Encountered -->',
      };
      await saveSourceFetch(fetchRecord);
      await saveSource({
        ...source,
        lastCheckedAt: startedAt,
        lastError: 'Instagram access restricted. Manual schedule entry active.',
        updatedBy: adminUid,
      });
      return NextResponse.json({
        success: false,
        status: 'restricted',
        message: 'Instagram source access restricted. Previous known schedule preserved.',
        fetchId,
        candidatesGenerated: 0,
      });
    }

    // ── Fetch with SSRF guard ───────────────────────────────────────────────
    let responseText = '';
    let httpStatus = 200;
    let contentType = 'text/html';
    let effectiveUrl = source.url;

    try {
      const result = await guardedFetch(
        source.url,
        {
          headers: {
            'User-Agent': 'SoCo-Food-Truck-Finder-Bot/1.0 (+https://example.com/bot)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        { maxRedirects: 3, timeoutMs: 10_000, maxResponseBytes: 5 * 1024 * 1024 }
      );

      responseText = result.text;
      httpStatus = result.httpStatus;
      contentType = result.contentType;
      effectiveUrl = result.effectiveUrl;

      if (httpStatus < 200 || httpStatus >= 300) {
        throw new Error(`HTTP Error ${httpStatus}`);
      }
    } catch (fetchErr: any) {
      const errorMsg = fetchErr.message || 'Network request failed';
      const failedRecord: SourceFetch = {
        id: fetchId,
        sourceId: source.id,
        fetchedAt: startedAt,
        status: 'failed',
        httpStatus: httpStatus || 0,
        errorMessage: errorMsg,
        rawPayload: '',
      };
      await saveSourceFetch(failedRecord);
      await saveSource({
        ...source,
        lastCheckedAt: startedAt,
        lastError: errorMsg,
        updatedBy: adminUid,
      });
      return NextResponse.json({
        success: false,
        status: 'failed',
        errorMessage: errorMsg,
        fetchId,
        candidatesGenerated: 0,
      });
    }

    // ── Content hash deduplication ─────────────────────────────────────────
    const contentHash = crypto.createHash('sha256').update(responseText).digest('hex');

    // Check the last successful fetch for this source
    const lastFetchSameHash = source.lastContentHash === contentHash;

    if (lastFetchSameHash) {
      // Content unchanged — log the check but skip extraction
      const noChangeFetchRecord: SourceFetch = {
        id: fetchId,
        sourceId: source.id,
        fetchedAt: startedAt,
        status: 'success',
        httpStatus,
        contentType,
        effectiveUrl,
        contentHash,
        parserUsed: source.parserType,
        rawPayload: '', // no need to re-store unchanged content
      };
      await saveSourceFetch(noChangeFetchRecord);
      await saveSource({
        ...source,
        lastCheckedAt: startedAt,
        lastSuccessfulAt: startedAt,
        lastError: undefined,
        lastContentHash: contentHash,
        updatedBy: adminUid,
      });
      return NextResponse.json({
        success: true,
        status: 'unchanged',
        message: 'Source content has not changed since the last fetch. Extraction skipped.',
        fetchId,
        candidatesGenerated: 0,
        contentHashMatch: true,
      });
    }

    // ── Record successful fetch ────────────────────────────────────────────
    const fetchRecord: SourceFetch = {
      id: fetchId,
      sourceId: source.id,
      fetchedAt: startedAt,
      status: 'success',
      httpStatus,
      contentType,
      effectiveUrl,
      contentHash,
      parserUsed: source.parserType,
      rawPayload: responseText.substring(0, 10_000),
    };
    await saveSourceFetch(fetchRecord);

    // ── Parse HTML with proper parser ─────────────────────────────────────
    let normalizedText: string;
    try {
      const { parse } = await import('node-html-parser');
      const root = parse(responseText);
      root.querySelectorAll('script, style, noscript, head').forEach((el) => el.remove());
      normalizedText = root.innerText.replace(/\s+/g, ' ').trim();
    } catch {
      // Fallback: basic regex stripping
      normalizedText = responseText
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // ── Extract candidates with pre-generated observation IDs ─────────────
    const vendorId = source.entityId || '';
    if (!vendorId) {
      return NextResponse.json(
        { error: 'Source has no entityId — cannot attribute candidates to a vendor' },
        { status: 400 }
      );
    }

    const rawText = normalizedText.length > 5 ? normalizedText : responseText;

    // Generate observation IDs before extraction so provenance is correct
    const { candidates, observationIds } = await extractScheduleCandidates({
      sourceId: source.id,
      vendorId,
      rawText,
      sourcePublicationTime: startedAt,
      fetchId,
    });

    // ── Persist candidates and their observations ──────────────────────────
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      await saveCandidate(cand);

      const obsId = observationIds[i];
      const obs: Observation = {
        id: obsId,
        sourceId: source.id,
        fetchId,
        vendorId: cand.vendorId,
        venueText: cand.proposedVenueText,
        matchedVenueId: cand.matchedVenueId,
        date: cand.date,
        startTime: cand.startTime,
        endTime: cand.endTime,
        rawExcerpt: cand.rawText,
        confidenceScore: cand.confidenceScore,
        extractedAt: startedAt,
      };
      await saveObservation(obs);
    }

    // ── Update source record ───────────────────────────────────────────────
    await saveSource({
      ...source,
      lastCheckedAt: startedAt,
      lastSuccessfulAt: startedAt,
      lastError: undefined,
      lastContentHash: contentHash,
      updatedBy: adminUid,
    });

    return NextResponse.json({
      success: true,
      status: 'success',
      fetchId,
      candidatesGenerated: candidates.length,
      candidates,
      performedBy: adminUid,
    });
  } catch (err: any) {
    console.error('Source fetch pipeline error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
