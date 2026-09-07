import { describe, it, expect } from 'vitest';
import {
  getTodayDateLA,
  getDateLA,
  formatDateDisplay,
  formatTimeDisplay,
  isCurrentlyOpen,
  getThisWeekRangeLA,
} from '../src/lib/timezone';
import {
  matchVenueAlias,
  getPublicAppearances,
  getAdminAppearances,
  saveAppearance,
} from '../src/lib/db/store';
import { extractScheduleCandidates } from '../src/lib/ingestion/ai-extractor';
import { mergeFavoritesOnSignIn } from '../src/lib/favorites';
import { Appearance } from '../src/types';

describe('America/Los_Angeles Timezone & Date Utilities', () => {
  it('should return YYYY-MM-DD format for getTodayDateLA()', () => {
    const todayStr = getTodayDateLA();
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should compute future date offset in America/Los_Angeles', () => {
    const tomorrowStr = getDateLA(1);
    expect(tomorrowStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should calculate This Week date range in America/Los_Angeles', () => {
    const { start, end } = getThisWeekRangeLA();
    expect(start).toBe(getTodayDateLA());
    expect(end.localeCompare(start)).toBeGreaterThanOrEqual(0);
  });

  it('should format 24h time strings into 12h AM/PM display', () => {
    expect(formatTimeDisplay('16:00')).toBe('4:00 PM');
    expect(formatTimeDisplay('09:30')).toBe('9:30 AM');
    expect(formatTimeDisplay('12:00')).toBe('12:00 PM');
    expect(formatTimeDisplay('00:00')).toBe('12:00 AM');
  });

  it('should evaluate isCurrentlyOpen correctly for historical dates', () => {
    expect(isCurrentlyOpen('2000-01-01', '12:00', '18:00')).toBe(false);
  });
});

describe('Venue Alias Matching Logic', () => {
  it('should match alias "Demo HenHouse" to canonical HenHouse tasting room venue', async () => {
    const venue = await matchVenueAlias('Demo HenHouse');
    expect(venue).not.toBeNull();
    expect(venue?.canonicalName).toContain('HenHouse');
  });

  it('should perform case-insensitive alias matching', async () => {
    const venue = await matchVenueAlias('cooperage beer demo');
    expect(venue).not.toBeNull();
    expect(venue?.canonicalName).toContain('Cooperage');
  });
});

describe('AI Schedule Ingestion Pipeline & Observation Extraction', () => {
  it('should extract candidate schedule from social media post excerpt', async () => {
    const samplePost =
      'This Friday slinging tacos at Demo HenHouse Tasting Room (Demo) from 4-8pm!';
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

describe('Public vs. Admin Appearance Data Separation', () => {
  it('should exclude unpublished appearances from getPublicAppearances()', async () => {
    const draftApp: Appearance = {
      id: 'app-draft-test-1',
      vendorId: 'vendor-galvans-demo',
      venueId: 'venue-henhouse-demo',
      date: getTodayDateLA(),
      startTime: '11:00',
      endTime: '14:00',
      status: 'scheduled',
      isPublished: false, // DRAFT / UNPUBLISHED
      isManualOverride: false,
      observationIds: [],
      createdBy: 'test-admin',
      updatedBy: 'test-admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveAppearance(draftApp);

    const publicApps = await getPublicAppearances({ date: getTodayDateLA() });
    const foundPublic = publicApps.find((a) => a.id === draftApp.id);
    expect(foundPublic).toBeUndefined();

    const adminApps = await getAdminAppearances({ date: getTodayDateLA() });
    const foundAdmin = adminApps.find((a) => a.id === draftApp.id);
    expect(foundAdmin).toBeDefined();
  });
});

describe('Authenticated & Anonymous Favorites Union Merge', () => {
  it('should deduplicate and perform union merge of local and account favorites', async () => {
    const accountFavs = ['vendor-galvans-demo', 'vendor-redwood-bbq-demo'];
    const merged = await mergeFavoritesOnSignIn('test-user-id', accountFavs);

    expect(merged).toContain('vendor-galvans-demo');
    expect(merged).toContain('vendor-redwood-bbq-demo');
    const uniqueSet = new Set(merged);
    expect(uniqueSet.size).toBe(merged.length);
  });
});
