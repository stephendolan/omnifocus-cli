import { handleError } from './errors.js';

/**
 * Parses a numeric option. A blank value becomes NaN, which validation
 * rejects; Number('') would be 0 and parseInt('2.5x') would be 2.
 */
export function parseNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error);
    }
  };
}
