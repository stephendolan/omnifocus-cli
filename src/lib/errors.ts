import { outputJson } from './output.js';
import { AutomationPermissionError } from './consent.js';

export class OmniFocusCliError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'OmniFocusCliError';
  }
}

const STATUS_CODES = {
  not_found: 404,
  ambiguous: 400,
  invalid: 400,
  verification_failed: 500,
  partial_write: 500,
  script_error: 500,
  bridge_error: 502,
  timeout: 504,
} as const;

export type OmniFocusErrorCode = keyof typeof STATUS_CODES;

export function isOmniFocusErrorCode(value: unknown): value is OmniFocusErrorCode {
  return typeof value === 'string' && Object.hasOwn(STATUS_CODES, value);
}

/** A failure reported by OmniFocus or by the bridge that reaches it. */
export class OmniFocusError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: OmniFocusErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OmniFocusError';
    this.statusCode = STATUS_CODES[code];
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
      },
    };
  }
  if (error instanceof OmniFocusCliError) {
    return { error: { name: 'cli_error', detail: error.message, statusCode: error.statusCode } };
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
