import { performance } from 'node:perf_hooks';
import { OmniFocusError } from './errors.js';

export type Execute = <T>(operation: () => Promise<T>) => Promise<T>;

export interface ExecutionGateOptions {
  /** Operations allowed inside OmniFocus at once. */
  maxConcurrent?: number;
  /** How long to hold calls after one times out. */
  cooldownMs?: number;
  /** How long a probe may stay unsettled before another call may take its place. */
  probeLimitMs?: number;
  /** A monotonic clock in milliseconds; wall-clock steps must not stretch a hold. */
  now?: () => number;
  log?: (message: string) => void;
}

// Codes that only OmniFocus itself produces: any of them shows the bridge answers.
const ANSWERED = new Set([
  'not_found',
  'ambiguous',
  'invalid',
  'verification_failed',
  'partial_write',
  'script_error',
  'expired',
]);

/**
 * Admits operations to OmniFocus. A call that times out leaves its Apple event
 * queued inside OmniFocus, where it holds a thread until OmniFocus gets to it,
 * so sending more calls into an unresponsive OmniFocus only deepens that queue.
 *
 * The gate is open until a call times out. It then holds: calls are rejected
 * without running for the cooldown. After the cooldown it admits one call at a
 * time as a probe. An answer from OmniFocus opens the gate, a probe that times
 * out starts another hold, and a failure that never reached OmniFocus, such as
 * rejected arguments, leaves the gate probing.
 */
export function createExecutionGate(options: ExecutionGateOptions = {}): Execute {
  const maxConcurrent = options.maxConcurrent ?? 16;
  const cooldownMs = options.cooldownMs ?? 30_000;
  const probeLimitMs = options.probeLimitMs ?? 150_000;
  const now = options.now ?? (() => performance.now());
  const log = (message: string) => {
    try {
      options.log?.(message);
    } catch {
      // A log that cannot be written must not fail the call it describes.
    }
  };
  let executing = 0;
  let heldUntil: number | null = null;
  let probeStartedAt: number | null = null;
  let answered = false;
  // Counts holds and openings. A call's outcome is evidence only about the
  // state it was admitted in: a timeout that arrives after the gate has held
  // or reopened says nothing new.
  let transitions = 0;

  function hold() {
    transitions++;
    heldUntil = now() + cooldownMs;
    log(`bridge=unresponsive holding calls for ${cooldownMs / 1000}s`);
  }

  function open() {
    if (!answered) {
      // Logged once so a restart can be confirmed from the log alone: successes are otherwise silent.
      answered = true;
      log('bridge=first-answer');
    }
    if (heldUntil === null) return;
    transitions++;
    heldUntil = null;
    log('bridge=responding');
  }

  return async function execute<T>(operation: () => Promise<T>): Promise<T> {
    if (executing >= maxConcurrent) {
      throw new OmniFocusError('busy', 'Too many concurrent OmniFocus operations');
    }
    let probe = false;
    if (heldUntil !== null) {
      const remainingMs = heldUntil - now();
      // A probe that has not settled within the limit is treated as lost, so it cannot shut the gate for good.
      const probing = probeStartedAt !== null && now() - probeStartedAt < probeLimitMs;
      if (remainingMs > 0 || probing) {
        const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
        throw new OmniFocusError(
          'unresponsive',
          `OmniFocus did not answer an earlier call, so this one was not sent. Retry in ${seconds}s.`
        );
      }
      probe = true;
      probeStartedAt = now();
    }

    const admittedAt = transitions;
    const started = probeStartedAt;
    executing++;
    try {
      const result = await operation();
      open();
      return result;
    } catch (error) {
      if (error instanceof OmniFocusError) {
        if (error.code === 'timeout') {
          if (admittedAt === transitions) hold();
        } else if (ANSWERED.has(error.code)) {
          open();
        }
      }
      throw error;
    } finally {
      executing--;
      if (probe && probeStartedAt === started) probeStartedAt = null;
    }
  };
}
