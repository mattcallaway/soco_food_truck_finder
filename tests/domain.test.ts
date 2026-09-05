import { describe, it, expect } from 'vitest';
import {
  getTodayDateLA,
  formatDateDisplay,
  formatTimeDisplay,
  isCurrentlyOpen,
} from '../src/lib/timezone';
import { matchVenueAlias } from '../src/lib/db/store';
import { extractScheduleCandidates } from '../src/lib/ingestion/ai-extractor';

describe('America/Los_Angeles Timezone Utilities', () => {
  it('should return YYYY-MM-DD format for getTodayDateLA()', () => {
    const todayStr = getTodayDateLA();
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should correctly format 24h time into 12h AM/PM display', () => {
    expect(formatTimeDisplay('16:00')).toBe('4:00 PM');
    expect(formatTimeDisplay('09:30')).toBe('9:30 AM');
    expect(formatTimeDisplay('12:00')).toBe('12:00 PM');
    expect(formatTimeDisplay('00:00')).toBe('12:00 AM');
  });

  it('should evaluate isCurrentlyOpen correctly for past and future dates', () => {
    expect(isCurrentlyOpen('2000-01-01', '12:00', '18:00')).toBe(false);
  });
});

describe('Venue Alias Matching Logic', () => {
  it('should match alias "Demo HenHouse" to canonical HenHouse tasting room venue', async () => {
    const venue = await matchVenueAlias('Demo HenHouse');
    expect(venue).not.toBeNull();
    expect(venue?.canonicalName).toContain('HenHouse');
  });
});

describe('AI Schedule Ingestion Pipeline', () => {
  it('should extract candidate schedule from social media post excerpt', async () => {
    const samplePost =
      "This Friday slinging tacos at Demo HenHouse Tasting Room (Demo) from 4-8pm!";
    const candidates = await extractScheduleCandidates({
      sourceId: 'test-src-1',
      vendorId: 'vendor-galvans-demo',
      rawText: samplePost,
    });

    expect(candidates.length).toBeGreaterThan(0);
    const cand = candidates[0];
    expect(cand.startTime).toBe('16:00');
    expect(cand.endTime).toBe('20:00');
    expect(cand.confidenceScore).toBeGreaterThan(0.5);
  });
});
