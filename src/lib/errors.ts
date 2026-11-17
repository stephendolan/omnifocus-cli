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

export function errorResponse(error: unknown) {
  let name = 'unknown_error';
  let detail = 'An unknown error occurred';
  let statusCode = 500;

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
  } else if (error instanceof OmniFocusCliError) {
    name = 'cli_error';
    detail = error.message;
    statusCode = error.statusCode;
  } else if (error instanceof Error) {
    name = 'omnifocus_error';
    detail = error.message;

    if (detail.includes('not found')) {
      statusCode = 404;
    } else if (detail.includes('Multiple')) {
      statusCode = 400;
    }
  }

  return { error: { name, detail, statusCode } };
}

export function handleError(error: unknown): void {
  outputJson(errorResponse(error));
  // Set exitCode instead of calling process.exit() to let the stdout pipe
  // buffer drain before the process terminates. Calling process.exit()
  // truncates piped output at ~512 bytes on macOS because pipe writes are
  // asynchronous. See https://nodejs.org/api/process.html#processexitcode
  process.exitCode = 1;
}
