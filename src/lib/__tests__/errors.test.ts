import { describe, it, expect, vi } from 'vitest';
import { handleError, OmniFocusCliError } from '../errors.js';

/**
 * Calls handleError while isolating the side effects: captures the JSON
 * written to stdout, captures the resulting process.exitCode, and restores
 * both before returning. This keeps the test runner's own exit status clean
 * (bun's native test runner reads process.exitCode at suite end).
 */
function runHandleError(error: unknown): { logged: unknown; exitCode: unknown } {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    handleError(error);
    const capturedExit = process.exitCode;
    const lastCall = logSpy.mock.calls.at(-1);
    const logged = lastCall ? JSON.parse(String(lastCall[0])) : undefined;
    return { logged, exitCode: capturedExit };
  } finally {
    logSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

describe('handleError', () => {
  it('sets process.exitCode to 1 without calling process.exit', () => {
    const { exitCode } = runHandleError(new Error('boom'));
    expect(exitCode).toBe(1);
  });

  it('returns normally so the event loop can drain stdout', () => {
    // If handleError still called process.exit(), this test would never
    // complete normally. Reaching the assertion proves the function returns.
    expect(() => runHandleError(new Error('boom'))).not.toThrow();
  });

  it('serializes OmniFocusCliError with its statusCode', () => {
    const { logged } = runHandleError(new OmniFocusCliError('bad request', 400));
    expect(logged).toEqual({
      error: { name: 'cli_error', detail: 'bad request', statusCode: 400 },
    });
  });

  it('maps "not found" errors to 404', () => {
    const { logged } = runHandleError(new Error('Task not found'));
    expect(logged).toEqual({
      error: { name: 'omnifocus_error', detail: 'Task not found', statusCode: 404 },
    });
  });

  it('maps "Multiple" errors to 400', () => {
    const { logged } = runHandleError(new Error('Multiple matches for "foo"'));
    expect(logged).toEqual({
      error: {
        name: 'omnifocus_error',
        detail: 'Multiple matches for "foo"',
        statusCode: 400,
      },
    });
  });

  it('falls back to unknown_error for non-Error values', () => {
    const { logged } = runHandleError('something weird');
    expect(logged).toEqual({
      error: { name: 'unknown_error', detail: 'An unknown error occurred', statusCode: 500 },
    });
  });
});
