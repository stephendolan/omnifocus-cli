import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleError, OmniFocusCliError } from '../errors.js';

describe('handleError', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  function lastLoggedJson(): unknown {
    const lastCall = logSpy.mock.calls.at(-1);
    if (!lastCall) throw new Error('console.log was not called');
    return JSON.parse(String(lastCall[0]));
  }

  it('sets process.exitCode to 1 without calling process.exit', () => {
    handleError(new Error('boom'));
    expect(process.exitCode).toBe(1);
  });

  it('returns normally so the event loop can drain stdout', () => {
    // If handleError still called process.exit(), this test would never
    // complete normally. Reaching the assertion proves the function
    // returns synchronously.
    expect(() => handleError(new Error('boom'))).not.toThrow();
  });

  it('serializes OmniFocusCliError with its statusCode', () => {
    handleError(new OmniFocusCliError('bad request', 400));
    expect(lastLoggedJson()).toEqual({
      error: { name: 'cli_error', detail: 'bad request', statusCode: 400 },
    });
  });

  it('maps "not found" errors to 404', () => {
    handleError(new Error('Task not found'));
    expect(lastLoggedJson()).toEqual({
      error: { name: 'omnifocus_error', detail: 'Task not found', statusCode: 404 },
    });
  });

  it('maps "Multiple" errors to 400', () => {
    handleError(new Error('Multiple matches for "foo"'));
    expect(lastLoggedJson()).toEqual({
      error: {
        name: 'omnifocus_error',
        detail: 'Multiple matches for "foo"',
        statusCode: 400,
      },
    });
  });

  it('falls back to unknown_error for non-Error values', () => {
    handleError('something weird');
    expect(lastLoggedJson()).toEqual({
      error: { name: 'unknown_error', detail: 'An unknown error occurred', statusCode: 500 },
    });
  });
});
