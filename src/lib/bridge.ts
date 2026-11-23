import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as runtime from '../omni/runtime.js';
import { AutomationPermissionError, consentPreflight } from './consent.js';
import { isChanges, isOmniFocusErrorCode, OmniFocusError } from './errors.js';

const execFileAsync = promisify(execFile);

export const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

// Operations call their helpers by name, so every runtime function travels with every call.
const RUNTIME_SOURCE = Object.values(runtime)
  .filter((member) => typeof member === 'function')
  .map(String)
  .join('\n');

/**
 * Builds the Omni Automation script for one operation. Functions are embedded
 * as source rather than referenced by name, because a bundler may rename them.
 * Arguments go through JSON.parse so that "__proto__" stays an ordinary key.
 * `deadline` is the epoch millisecond after which the script must not run.
 */
export function composeOmniScript<A>(
  operation: (args: A) => unknown,
  args: A,
  deadline: number
): string {
  const encodedArgs = JSON.stringify(JSON.stringify(args ?? null));
  return `${RUNTIME_SOURCE}\n(${String(runtime.invoke)})(${String(operation)}, JSON.parse(${encodedArgs}), ${Number(deadline)});`;
}

/** Wraps an Omni Automation script in the JXA that hands it to OmniFocus. */
export function wrapOmniScript(omniScript: string): string {
  return `
    ${consentPreflight()}
    const app = Application('OmniFocus');
    app.includeStandardAdditions = true;
    const result = app.evaluateJavascript(${JSON.stringify(omniScript)});
    result;
  `.trim();
}

export async function runOsascript(
  script: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const osascript = execFileAsync('osascript', ['-l', 'JavaScript', '-'], {
    timeout: timeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  // osascript's exit status reports failures; ignore EPIPE if it exits before reading stdin.
  osascript.child.stdin?.on('error', () => {});
  osascript.child.stdin?.end(script);

  try {
    const { stdout } = await osascript;
    return stdout.trim();
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
    const permission = failure.stderr?.match(/OF_AUTOMATION_PERMISSION:(-?\d+)/);
    if (permission) throw new AutomationPermissionError(Number(permission[1]));
    if (failure.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw new OmniFocusError(
        'bridge_error',
        `OmniFocus returned more than ${MAX_OUTPUT_BYTES / 1024 / 1024} MB. Narrow the request.`,
        { cause: error }
      );
    }
    if (failure.killed) {
      throw new OmniFocusError(
        'timeout',
        `OmniFocus automation did not respond within ${timeoutMs}ms. Check OmniFocus and macOS Automation permissions in this login session.`,
        { cause: error }
      );
    }
    throw new OmniFocusError(
      'bridge_error',
      `osascript failed: ${failure.stderr?.trim() || failure.message}`,
      { cause: error }
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads the envelope `invoke` returns, throwing the failure it reports. */
export function decodeOmniResult<R>(output: string): R {
  let envelope: unknown;
  try {
    envelope = JSON.parse(output);
  } catch {
    throw new OmniFocusError('bridge_error', 'OmniFocus returned a result that is not JSON');
  }
  if (isRecord(envelope) && envelope.ok === true) return envelope.value as R;
  if (isRecord(envelope) && envelope.ok === false && isRecord(envelope.error)) {
    const { code, name, message } = envelope.error;
    const changes = isChanges(envelope.error.changes) ? envelope.error.changes : undefined;
    if (isOmniFocusErrorCode(code) && code !== 'script_error') {
      throw new OmniFocusError(code, String(message), { changes });
    }
    throw new OmniFocusError('script_error', `OmniFocus script error: ${name}: ${message}`, {
      changes,
    });
  }
  throw new OmniFocusError('bridge_error', 'OmniFocus returned an unrecognized result');
}
