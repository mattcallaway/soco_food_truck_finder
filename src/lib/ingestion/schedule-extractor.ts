/**
 * Heuristic schedule text extractor.
 *
 * Converts unstructured schedule posts (website text, feed content) into
 * validated ExtractionCandidate objects for administrator review.
 *
 * This is a deterministic, regex-based heuristic parser — not an LLM.
 * Confidence scores reflect extraction certainty for human reviewers.
 *
 * If an LLM adapter is added in future, it should be an optional step:
 *   normalized source → heuristic extraction → optional LLM validation
 *   → confidence → candidate
 * The lack of an AI credential must never break ingestion.
 */
import crypto from 'crypto';
import { ExtractionCandidate } from '@/types';
import { matchVenueAlias, getAppearances } from '../db/store';
import { getTodayDateLA, getDateLA } from '../timezone';

export interface RawExtractionInput {
  sourceId: string;
  vendorId: string;
  rawText: string;
  /** ISO-8601 timestamp of source publication — used for relative date resolution.
   *  Falls back to ingestion time if unavailable. */
  sourcePublicationTime?: string;
  /** SourceFetch ID for provenance tracking */
  fetchId?: string;
}

export interface ExtractionResult {
  candidates: ExtractionCandidate[];
  /** Observation IDs parallel to candidates — observationIds[i] is the ID for candidates[i] */
  observationIds: string[];
}

/**
 * Heuristic text schedule extraction.
 * Returns candidates and pre-generated observation IDs so provenance is preserved.
 */
export async function extractScheduleCandidates(
  input: RawExtractionInput
): Promise<ExtractionResult> {
  const { sourceId, vendorId, rawText, sourcePublicationTime } = input;
  const candidates: ExtractionCandidate[] = [];
  const observationIds: string[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return { candidates, observationIds };
  }

  // Resolve "today" relative to the source publication time (or ingestion time as fallback)
  const refDate = sourcePublicationTime
    ? new Date(sourcePublicationTime)
    : new Date();

  const todayStr = getTodayDateLA();

  // Split multi-sentence or multi-day announcements
  const segments = rawText.split(
    /(?=\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Today|Tomorrow|Tonight)\b)/i
  );

  for (let i = 0; i < segments.length; i++) {
    const text = segments[i].trim();
    if (!text || text.length < 5) continue;

    // ── Date resolution ──────────────────────────────────────────────────────
    let dateStr = todayStr;
    let dateIsEstimated = false;
    const dayMatch = text.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);

    if (dayMatch) {
      dateStr = resolveRelativeDayOfWeekFromRef(dayMatch[1], refDate);
    } else if (/\btomorrow\b/i.test(text)) {
      dateStr = getDateLA(1, refDate);
    } else if (/\btonight\b/i.test(text)) {
      // tonight = same date as refDate, interpreted in LA timezone
      dateStr = getDateLA(0, refDate);
    } else {
      dateIsEstimated = true;
    }

    // ── Time extraction ──────────────────────────────────────────────────────
    let startTime = '16:00';
    let endTime = '20:00';
    const timeMatch = text.match(
      /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
    );

    if (timeMatch) {
      let [, startH, startM, startAmpm, endH, endM, endAmpm] = timeMatch;
      let sH = parseInt(startH, 10);
      let eH = parseInt(endH, 10);

      const defaultAmpm = endAmpm || startAmpm || (sH < 11 ? 'am' : 'pm');
      if (!startAmpm) startAmpm = defaultAmpm;
      if (!endAmpm) endAmpm = defaultAmpm;

      if (startAmpm.toLowerCase() === 'pm' && sH < 12) sH += 12;
      if (startAmpm.toLowerCase() === 'am' && sH === 12) sH = 0;
      if (endAmpm.toLowerCase() === 'pm' && eH < 12) eH += 12;
      if (endAmpm.toLowerCase() === 'am' && eH === 12) eH = 0;

      startTime = `${String(sH).padStart(2, '0')}:${startM || '00'}`;
      endTime = `${String(eH).padStart(2, '0')}:${endM || '00'}`;
    }

    // ── Venue extraction ─────────────────────────────────────────────────────
    let proposedVenueText = 'Unknown Venue';
    const venueMatch = text.match(
      /\bat\s+([A-Za-z0-9\s'\u2013()-]+?)(?=\s+from|\s+between|\s+\d|!|\.|$)/i
    );
    if (venueMatch && venueMatch[1]) {
      proposedVenueText = venueMatch[1].trim();
    }

    // Skip fragments that have neither venue nor time match
    if (!timeMatch && proposedVenueText === 'Unknown Venue') {
      continue;
    }

    // ── Venue matching ───────────────────────────────────────────────────────
    const matchedVenue = await matchVenueAlias(proposedVenueText);

    // ── Confidence scoring ───────────────────────────────────────────────────
    let confidenceScore = 0.85;
    const warnings: string[] = [];

    if (!sourcePublicationTime) {
      warnings.push('Source publication time unavailable — relative dates resolved from ingestion time.');
      confidenceScore -= 0.05;
    }

    if (dateIsEstimated) {
      warnings.push('Date not explicitly stated — defaulting to today. Human verification recommended.');
      confidenceScore -= 0.1;
    }

    if (matchedVenue) {
      if (matchedVenue.canonicalName.toLowerCase() !== proposedVenueText.toLowerCase()) {
        warnings.push(`Venue matched via alias: "${matchedVenue.canonicalName}"`);
        confidenceScore -= 0.05;
      }
    } else {
      warnings.push(`Unmatched venue name: "${proposedVenueText}". Human review required.`);
      confidenceScore -= 0.35;
    }

    if (!timeMatch) {
      warnings.push('Time range estimated (default 4:00 PM – 8:00 PM). Verify actual hours.');
      confidenceScore -= 0.15;
    }

    // ── Conflict check ───────────────────────────────────────────────────────
    const existingApps = await getAppearances({ vendorId, date: dateStr });
    let hasConflicts = false;
    let conflictNotes: string | undefined;

    if (existingApps.length > 0) {
      const conflict = existingApps.find(
        (a) => a.venueId !== matchedVenue?.id && !(a.endTime <= startTime || a.startTime >= endTime)
      );
      if (conflict) {
        hasConflicts = true;
        conflictNotes = `Time overlap conflict with existing appearance at venue ${conflict.venueId}`;
        confidenceScore -= 0.2;
      }
    }

    // ── Generate IDs with crypto.randomUUID() ────────────────────────────────
    const candidateId = `cand-${crypto.randomUUID()}`;
    const obsId = `obs-${crypto.randomUUID()}`;

    const candidate: ExtractionCandidate = {
      id: candidateId,
      sourceId,
      vendorId,
      rawText: text,
      proposedVenueText,
      matchedVenueId: matchedVenue?.id,
      date: dateStr,
      startTime,
      endTime,
      confidenceScore: Math.max(0.1, Math.min(1.0, confidenceScore)),
      validationWarnings: warnings,
      hasConflicts,
      conflictNotes,
      observationIds: [obsId], // ID matches what the route will save
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    candidates.push(candidate);
    observationIds.push(obsId);
  }

  return { candidates, observationIds };
}

/**
 * Resolves a day-of-week name to a YYYY-MM-DD date string using LA timezone.
 * Uses the provided reference date (source publication time or ingestion time).
 */
function resolveRelativeDayOfWeekFromRef(dayName: string, refDate: Date): string {
  const daysMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };

  const targetDay = daysMap[dayName.toLowerCase()];
  if (targetDay === undefined) return getTodayDateLA();

  // Get current day-of-week in LA timezone (not server UTC)
  const laDateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
  }).format(refDate);

  const shortDayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const currentDayLA = shortDayMap[laDateStr] ?? refDate.getDay();

  let diff = targetDay - currentDayLA;
  if (diff < 0) diff += 7; // Next occurrence of that weekday
  if (diff === 0) diff = 7; // Assume "next Friday" if today is Friday

  return getDateLA(diff, refDate);
}
