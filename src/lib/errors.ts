import { outputJson } from './output.js';
import { AutomationPermissionError } from './consent.js';

/**
 * What a failed request did to the database:
 * `none` changed nothing, `unknown` may have been applied, and `partial`
 * applied some of the request and could not take it back.
 */
export type Changes = 'none' | 'unknown' | 'partial';

export function isChanges(value: unknown): value is Changes {
  return value === 'none' || value === 'unknown' || value === 'partial';
}

export class OmniFocusCliError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'OmniFocusCliError';
  }
}

// Each code's status, and what a write that failed with it did. A read never
// changes anything; OmniFocus.run() says so whatever the code.
const ERROR_CODES = {
  not_found: { statusCode: 404, changes: 'none' },
  ambiguous: { statusCode: 400, changes: 'none' },
  invalid: { statusCode: 400, changes: 'none' },
  verification_failed: { statusCode: 500, changes: 'none' },
  partial_write: { statusCode: 500, changes: 'partial' },
  script_error: { statusCode: 500, changes: 'unknown' },
  bridge_error: { statusCode: 502, changes: 'unknown' },
  timeout: { statusCode: 504, changes: 'unknown' },
  expired: { statusCode: 504, changes: 'none' },
  unresponsive: { statusCode: 503, changes: 'none' },
  busy: { statusCode: 503, changes: 'none' },
} as const satisfies Record<string, { statusCode: number; changes: Changes }>;

export type OmniFocusErrorCode = keyof typeof ERROR_CODES;

export function isOmniFocusErrorCode(value: unknown): value is OmniFocusErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}

/** A failure reported by OmniFocus or by the bridge that reaches it. */
export class OmniFocusError extends Error {
  readonly statusCode: number;
  changes: Changes;

  constructor(
    readonly code: OmniFocusErrorCode,
    message: string,
    options: ErrorOptions & { changes?: Changes } = {}
  ) {
    super(message, options);
    this.name = 'OmniFocusError';
    this.statusCode = ERROR_CODES[code].statusCode;
    this.changes = options.changes ?? ERROR_CODES[code].changes;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AutomationPermissionError) {
    return {
      error: {
        name: error.name,
        detail: error.message,
        statusCode: error.statusCode,
        osStatus: error.osStatus,
        execPath: error.execPath,
        // The preflight fails before any Apple event is sent.
        changes: 'none' as Changes,
      },
    };
  }
  if (error instanceof OmniFocusError) {
    return {
      error: {
        name: 'omnifocus_error',
        detail: error.message,
        statusCode: error.statusCode,
        code: error.code,
        changes: error.changes,
      },
    };
  }
  if (error instanceof OmniFocusCliError) {
    return {
      error: {
        name: 'cli_error',
        detail: error.message,
        statusCode: error.statusCode,
        // Arguments are rejected before OmniFocus is contacted.
        changes: 'none' as Changes,
      },
    };
  }
  if (error instanceof Error) {
    return { error: { name: 'omnifocus_error', detail: error.message, statusCode: 500 } };
  }
  return {
    error: { name: 'unknown_error', detail: 'An unknown error occurred', statusCode: 500 },
  };
}

export function handleError(error: unknown): void {
  outputJson(errorResponse(error));
  // Set exitCode instead of calling process.exit() to let the stdout pipe
  // buffer drain before the process terminates. Calling process.exit()
  // truncates piped output at ~512 bytes on macOS because pipe writes are
  // asynchronous. See https://nodejs.org/api/process.html#processexitcode
  process.exitCode = 1;
}
