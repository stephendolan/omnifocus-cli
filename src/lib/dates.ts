import dayjs from 'dayjs';
import { OmniFocusCliError } from './errors.js';

export function parseDateTime(input: string): string {
  const d = dayjs(input);
  if (!d.isValid()) {
    throw new OmniFocusCliError(`Invalid date: ${input}`, 400);
  }
  return d.toISOString();
}
