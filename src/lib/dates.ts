import dayjs from 'dayjs';
import { OmniFocusCliError } from './errors.js';

// The fields of a year-first date, as the date library reads them: separators
// may be dashes, slashes, or absent, and every part after the year is optional.
const YEAR_FIRST =
  /^\s*(\d{4})[-/]?(\d{1,2})?[-/]?(\d{1,2})?[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Whether every field of a year-first date names a real month, day, and time. */
function fieldsExist(input: string): boolean {
  const match = YEAR_FIRST.exec(input);
  if (!match) return true;
  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map((part) => (part === undefined ? undefined : Number(part)));
  if (month !== undefined && (month < 1 || month > 12)) return false;
  if (day !== undefined && (day < 1 || day > daysInMonth(year as number, month ?? 1))) return false;
  return (hour ?? 0) <= 23 && (minute ?? 0) <= 59 && (second ?? 0) <= 59;
}

/**
 * Parses a date or date-time into ISO 8601. A date or time that does not
 * exist, such as 2026-02-30 or 24:30, is rejected: the date parser would
 * otherwise roll it over into the next month or day and the caller would get a
 * different moment than it asked for.
 */
export function parseDateTime(input: string): string {
  const parsed = dayjs(input);
  if (!parsed.isValid() || !fieldsExist(input)) {
    throw new OmniFocusCliError(`Invalid date: ${input}`, 400);
  }
  return parsed.toISOString();
}
