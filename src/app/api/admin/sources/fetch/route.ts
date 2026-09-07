import { NextResponse } from 'next/server';
import {
  getSources,
  saveSource,
  saveSourceFetch,
  saveObservation,
  saveCandidate,
} from '@/lib/db/store';
import { extractScheduleCandidates } from '@/lib/ingestion/ai-extractor';
import { SourceFetch, Observation } from '@/types';
import crypto from 'crypto';

export async function POST(request: Request) {
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

    const fetchId = `fetch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const startedAt = new Date().toISOString();

    // Check if source is Instagram
    if (source.sourceType === 'instagram') {
      const fetchRecord: SourceFetch = {
        id: fetchId,
        sourceId: source.id,
        fetchedAt: startedAt,
        status: 'restricted',
        httpStatus: 403,
        contentType: 'text/html',
        effectiveUrl: source.url,
        errorMessage: 'Instagram data access restricted (login wall). Preserving manual and alternative schedule sources.',
        rawPayload: '<!-- Instagram Login Wall Encountered -->',
      };

      await saveSourceFetch(fetchRecord);
      await saveSource({
        ...source,
        lastCheckedAt: startedAt,
        lastError: 'Instagram access restricted. Manual schedule entry active.',
      });

      return NextResponse.json({
        success: false,
        status: 'restricted',
        message: 'Instagram source access restricted. Previous known schedule preserved.',
        fetchId,
        candidatesGenerated: 0,
      });
    }

    // Perform actual server-side HTTP fetch for public webpages & feeds
    let responseText = '';
    let httpStatus = 200;
    let contentType = 'text/html';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch(source.url, {
        headers: {
          'User-Agent': 'SoCo-Food-Truck-Finder-Bot/1.0 (+https://example.com/bot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      httpStatus = res.status;
      contentType = res.headers.get('content-type') || 'text/html';

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      responseText = await res.text();
    } catch (fetchErr: any) {
      const errorMsg = fetchErr.message || 'Network request failed';
      const failedRecord: SourceFetch = {
        id: fetchId,
        sourceId: source.id,
        fetchedAt: startedAt,
        status: 'failed',
        httpStatus: httpStatus || 500,
        errorMessage: errorMsg,
        rawPayload: '',
      };

      await saveSourceFetch(failedRecord);
      await saveSource({
        ...source,
        lastCheckedAt: startedAt,
        lastError: errorMsg,
      });

      return NextResponse.json({
        success: false,
        status: 'failed',
        errorMessage: errorMsg,
        fetchId,
        candidatesGenerated: 0,
      });
    }

    // Compute content hash
    const contentHash = crypto.createHash('sha256').update(responseText).digest('hex');

    // Save successful SourceFetch record
    const fetchRecord: SourceFetch = {
      id: fetchId,
      sourceId: source.id,
      fetchedAt: startedAt,
      status: 'success',
      httpStatus,
      contentType,
      effectiveUrl: source.url,
      contentHash,
      parserUsed: source.parserType,
      rawPayload: responseText.substring(0, 10000), // Limit payload size saved to store
    };

    await saveSourceFetch(fetchRecord);

    // Normalize HTML content to clean text
    const normalizedText = responseText
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract schedule candidates using text schedule parser
    const candidates = await extractScheduleCandidates({
      sourceId: source.id,
      vendorId: source.entityId || 'vendor-galvans-demo',
      rawText: normalizedText.length > 5 ? normalizedText : responseText,
      sourcePublicationTime: startedAt,
    });

    // Save candidates and observations to persistent store
    for (const cand of candidates) {
      await saveCandidate(cand);
      const obs: Observation = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

    // Update Source record with last check success
    await saveSource({
      ...source,
      lastCheckedAt: startedAt,
      lastSuccessfulAt: startedAt,
      lastError: undefined,
    });

    return NextResponse.json({
      success: true,
      status: 'success',
      fetchId,
      candidatesGenerated: candidates.length,
      candidates,
    });
  } catch (err: any) {
    console.error('Source fetch pipeline error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
