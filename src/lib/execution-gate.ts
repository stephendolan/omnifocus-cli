import { OmniFocusError } from './errors.js';

export type Execute = <T>(operation: () => Promise<T>) => Promise<T>;

export interface ExecutionGateOptions {
  /** Operations allowed inside OmniFocus at once. */
  maxConcurrent?: number;
  /** How long to hold calls after one times out. */
  cooldownMs?: number;
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
 * After a timeout the gate therefore rejects calls without running them until
 * the cooldown passes, then lets a single call through to find out whether
 * OmniFocus answers again.
 */
export function createExecutionGate(options: ExecutionGateOptions = {}): Execute {
  const maxConcurrent = options.maxConcurrent ?? 16;
  const cooldownMs = options.cooldownMs ?? 30_000;
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => {});
  let executing = 0;
  let heldUntil: number | null = null;
  let probing = false;

  function hold(wasProbe: boolean) {
    // A call already in flight when the hold began says nothing new by timing out.
    if (heldUntil !== null && !wasProbe) return;
    heldUntil = now() + cooldownMs;
    log(`bridge=unresponsive holding calls for ${cooldownMs / 1000}s`);
  }

  function release() {
    if (heldUntil === null) return;
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
      if (remainingMs > 0 || probing) {
        const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
        throw new OmniFocusError(
          'unresponsive',
          `OmniFocus did not answer an earlier call, so this one was not sent. Retry in ${seconds}s.`
        );
      }
      probe = probing = true;
    }

    executing++;
    try {
      const result = await operation();
      release();
      return result;
    } catch (error) {
      if (error instanceof OmniFocusError) {
        if (error.code === 'timeout') hold(probe);
        else if (ANSWERED.has(error.code)) release();
      }
      throw error;
    } finally {
      executing--;
      if (probe) probing = false;
    }
  };
}
