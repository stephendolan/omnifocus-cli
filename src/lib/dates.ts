import dayjs from 'dayjs';
import { OmniFocusCliError } from './errors.js';

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parses a date or date-time into ISO 8601. A date that does not exist, such
 * as 2026-02-30, is rejected: the date parser would otherwise roll it over
 * into the next month and the caller would get a different day than it asked for.
 */
export function parseDateTime(input: string): string {
  const parsed = dayjs(input);
  const calendar = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/.exec(input);
  const exists = !calendar || isCalendarDate(+calendar[1], +calendar[2], +calendar[3]);
  if (!parsed.isValid() || !exists) {
    throw new OmniFocusCliError(`Invalid date: ${input}`, 400);
  }
  return parsed.toISOString();
}
