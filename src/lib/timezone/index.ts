export const APP_TIMEZONE = 'America/Los_Angeles';

/**
 * Returns YYYY-MM-DD for current time in America/Los_Angeles timezone.
 */
export function getTodayDateLA(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Returns YYYY-MM-DD for date + daysOffset in America/Los_Angeles.
 * @param daysOffset  Number of days to add to refDate (or now).
 * @param refDate     Optional reference date (defaults to current server time).
 */
export function getDateLA(daysOffset: number = 0, refDate?: Date): string {
  const d = new Date(refDate ?? new Date());
  d.setDate(d.getDate() + daysOffset);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Returns current HH:mm in America/Los_Angeles.
 */
export function getCurrentTimeLA(): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date());
}

/**
 * Returns range for 'This Week' (today through Sunday/7 days from now).
 */
export function getThisWeekRangeLA(): { start: string; end: string } {
  const start = getTodayDateLA();
  const end = getDateLA(7);
  return { start, end };
}

/**
 * Formats YYYY-MM-DD into readable date (e.g. 'Friday, Sep 11').
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Formats 24h HH:mm into 12h AM/PM (e.g. '16:00' -> '4:00 PM').
 */
export function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Checks if an appearance is currently active right now in LA timezone.
 */
export function isCurrentlyOpen(dateStr: string, startTime: string, endTime: string): boolean {
  const todayLA = getTodayDateLA();
  if (dateStr !== todayLA) return false;

  const nowTime = getCurrentTimeLA(); // e.g. "14:30"
  return nowTime >= startTime && nowTime <= endTime;
}
