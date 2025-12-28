import { outputJson } from './output.js';

export class OmniFocusCliError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'OmniFocusCliError';
  }
}

export function handleError(error: unknown): never {
  let name = 'unknown_error';
  let detail = 'An unknown error occurred';
  let statusCode = 500;

  if (error instanceof OmniFocusCliError) {
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

  outputJson({ error: { name, detail, statusCode } });
  process.exit(1);
}
