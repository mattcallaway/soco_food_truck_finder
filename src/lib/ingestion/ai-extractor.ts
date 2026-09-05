import { ExtractionCandidate, Observation } from '@/types';
import { matchVenueAlias, getAppearances } from '../db/store';
import { getTodayDateLA, getDateLA } from '../timezone';

export interface RawExtractionInput {
  sourceId: string;
  vendorId: string;
  rawText: string;
  sourcePublicationTime?: string;
}

/**
 * Heuristic & AI text schedule extraction parser.
 * Converts unstructured schedule posts into validated ExtractionCandidates.
 */
export async function extractScheduleCandidates(
  input: RawExtractionInput
): Promise<ExtractionCandidate[]> {
  const { sourceId, vendorId, rawText } = input;
  const candidates: ExtractionCandidate[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return [];
  }

  // Split multi-sentence or multi-day announcements (e.g., separated by "and", "Friday...", "Saturday...")
  const segments = rawText.split(/(?=\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Today|Tomorrow)\b)/i);

  const todayStr = getTodayDateLA();

  for (let i = 0; i < segments.length; i++) {
    const text = segments[i].trim();
    if (!text || text.length < 5) continue;

    // Detect Day of Week
    let dateStr = todayStr;
    const dayMatch = text.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
    if (dayMatch) {
      dateStr = resolveRelativeDayOfWeek(dayMatch[1]);
    } else if (/tomorrow/i.test(text)) {
      dateStr = getDateLA(1);
    }

    // Detect Time Range (e.g. 4-8pm, 4pm-8pm, 12:00-19:00, 4 to 8)
    let startTime = '16:00';
    let endTime = '20:00';
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

    if (timeMatch) {
      let [_, startH, startM, startAmpm, endH, endM, endAmpm] = timeMatch;
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

    // Detect Venue Name (words following 'at' or 'in')
    let proposedVenueText = 'Unknown Venue';
    const venueMatch = text.match(/\bat\s+([A-Za-z0-9\s'–()-]+?)(?=\s+from|\s+between|\s+\d|\!|\.|$)/i);
    if (venueMatch && venueMatch[1]) {
      proposedVenueText = venueMatch[1].trim();
    }

    // Skip fragments that have neither venue nor time match
    if (!timeMatch && proposedVenueText === 'Unknown Venue') {
      continue;
    }

    // Match Venue via canonical name or aliases
    const matchedVenue = await matchVenueAlias(proposedVenueText);

    // Calculate Confidence Score
    let confidenceScore = 0.85;
    const warnings: string[] = [];

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
      warnings.push('Time range estimated (default 4:00 PM - 8:00 PM)');
      confidenceScore -= 0.15;
    }

    // Conflict Check against existing published appearances
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

    const candidateId = `cand-extracted-${Date.now()}-${i}`;
    const obsId = `obs-${Date.now()}-${i}`;

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
      observationIds: [obsId],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    candidates.push(candidate);
  }

  return candidates;
}

function resolveRelativeDayOfWeek(dayName: string): string {
  const daysMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDay = daysMap[dayName.toLowerCase()];
  if (targetDay === undefined) return getTodayDateLA();

  const d = new Date();
  const currentDay = d.getDay();
  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7; // Next occurrence of that weekday

  return getDateLA(diff);
}
