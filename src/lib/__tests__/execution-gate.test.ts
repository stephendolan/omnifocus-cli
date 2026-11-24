import { describe, expect, it } from 'bun:test';
import { OmniFocusCliError, OmniFocusError } from '../errors.js';
import { createExecutionGate } from '../execution-gate.js';

const HELD = 'bridge=unresponsive holding calls for 30s';
const OPEN = 'bridge=responding';
const FIRST = 'bridge=first-answer';

function gate(options: { maxConcurrent?: number; log?: (line: string) => void } = {}) {
  let time = 1_000_000;
  const lines: string[] = [];
  const execute = createExecutionGate({
    maxConcurrent: options.maxConcurrent,
    cooldownMs: 30_000,
    probeLimitMs: 150_000,
    now: () => time,
    log: options.log ?? ((line) => lines.push(line)),
  });
  let calls = 0;
  /** Starts an operation the test settles by hand. */
  function pending() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = execute(() => {
      calls++;
      return new Promise<string>((done, fail) => {
        resolve = () => done('ok');
        reject = fail;
      });
    });
    const settled = promise.then(
      (value) => value,
      (error: OmniFocusError) => error
    );
    return { settled, resolve: () => resolve(), reject: (error: Error) => reject(error) };
  }
  const answers = () =>
    execute(async () => {
      calls++;
      return 'ok';
    });
  const fails = (error: Error) =>
    execute(async () => {
      calls++;
      throw error;
    });
  return {
    execute,
    pending,
    answers,
    fails,
    lines,
    advance: (ms: number) => {
      time += ms;
    },
    get calls() {
      return calls;
    },
  };
}

const timeout = () => new OmniFocusError('timeout', 'no answer');

async function rejection(promise: Promise<unknown>): Promise<OmniFocusError> {
  return promise.then(
    () => {
      throw new Error('Expected a rejection');
    },
    (error: OmniFocusError) => error
  );
}

/** Holds a fresh gate with one timeout and steps past the cooldown, so the next call is a probe. */
async function probing() {
  const g = gate();
  expect((await rejection(g.fails(timeout()))).code).toBe('timeout');
  g.advance(30_000);
  return g;
}

describe('execution gate', () => {
  it('passes results and failures through while OmniFocus answers', async () => {
    const g = gate();
    expect(await g.answers()).toBe('ok');
    expect(await rejection(g.fails(new OmniFocusError('not_found', 'missing')))).toMatchObject({
      code: 'not_found',
    });
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual([FIRST]);
  });

  it('rejects calls beyond its capacity without running them', async () => {
    const g = gate({ maxConcurrent: 2 });
    const running = [g.pending(), g.pending()];
    expect(await rejection(g.answers())).toMatchObject({
      code: 'busy',
      statusCode: 503,
      changes: 'none',
    });
    expect(g.calls).toBe(2);
    running.forEach((call) => call.resolve());
    await Promise.all(running.map((call) => call.settled));
    expect(await g.answers()).toBe('ok');
    expect(g.calls).toBe(3);
  });

  it('holds calls after a timeout without sending them, then lets one through', async () => {
    const g = gate();
    await rejection(g.fails(timeout()));
    expect(g.calls).toBe(1);

    const held = await rejection(g.answers());
    expect(held).toMatchObject({ code: 'unresponsive', statusCode: 503, changes: 'none' });
    expect(held.message).toBe(
      'OmniFocus did not answer an earlier call, so this one was not sent. Retry in 30s.'
    );
    g.advance(29_000);
    expect((await rejection(g.answers())).message).toContain('Retry in 1s.');
    expect(g.calls).toBe(1);

    g.advance(1_000);
    expect(await g.answers()).toBe('ok');
    expect(g.calls).toBe(2);
    expect(g.lines).toEqual([HELD, FIRST, OPEN]);
    // Open again: calls run side by side.
    const together = [g.pending(), g.pending()];
    expect(g.calls).toBe(4);
    together.forEach((call) => call.resolve());
    await Promise.all(together.map((call) => call.settled));
  });

  it('admits only one call while it finds out whether OmniFocus answers again', async () => {
    const g = await probing();
    const probe = g.pending();
    expect(await rejection(g.answers())).toMatchObject({ code: 'unresponsive' });
    expect(g.calls).toBe(2);
    probe.resolve();
    expect(await probe.settled).toBe('ok');
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual([HELD, FIRST, OPEN]);
  });

  it('holds again when the probe also times out', async () => {
    const g = await probing();
    expect((await rejection(g.fails(timeout()))).code).toBe('timeout');
    expect(await rejection(g.answers())).toMatchObject({ code: 'unresponsive' });
    expect(g.calls).toBe(2);
    g.advance(30_000);
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual([HELD, HELD, FIRST, OPEN]);
  });

  it('does not extend a hold when calls already in flight time out', async () => {
    const g = gate();
    const inFlight = [g.pending(), g.pending(), g.pending()];
    inFlight[0].reject(timeout());
    await inFlight[0].settled;
    g.advance(20_000);
    inFlight[1].reject(timeout());
    inFlight[2].reject(timeout());
    await Promise.all(inFlight.map((call) => call.settled));
    g.advance(10_000);
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual([HELD, FIRST, OPEN]);
  });

  it('ignores a timeout from a call sent before the gate reopened', async () => {
    const g = gate();
    const slow = g.pending();
    await rejection(g.fails(timeout()));
    g.advance(30_000);
    expect(await g.answers()).toBe('ok');
    slow.reject(timeout());
    expect(await slow.settled).toMatchObject({ code: 'timeout' });
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual([HELD, FIRST, OPEN]);
  });

  it('reopens as soon as any call in flight is answered', async () => {
    const g = gate();
    const slow = g.pending();
    await rejection(g.fails(timeout()));
    expect(await rejection(g.answers())).toMatchObject({ code: 'unresponsive' });
    slow.resolve();
    await slow.settled;
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual([HELD, FIRST, OPEN]);
  });

  it('opens on any answer from OmniFocus, including a failure', async () => {
    for (const code of [
      'not_found',
      'ambiguous',
      'invalid',
      'verification_failed',
      'partial_write',
      'script_error',
      'expired',
    ] as const) {
      const g = await probing();
      expect((await rejection(g.fails(new OmniFocusError(code, 'answered')))).code).toBe(code);
      expect(g.lines).toEqual([HELD, FIRST, OPEN]);
      const together = [g.pending(), g.pending()];
      expect(g.calls).toBe(4);
      together.forEach((call) => call.resolve());
      await Promise.all(together.map((call) => call.settled));
    }
  });

  it('keeps probing one call at a time after a failure that never reached OmniFocus', async () => {
    for (const error of [
      new OmniFocusCliError('Invalid arguments', 400),
      new OmniFocusError('bridge_error', 'osascript failed'),
      new Error('unexpected'),
    ]) {
      const g = await probing();
      expect(await rejection(g.fails(error))).toBe(error as OmniFocusError);
      expect(g.lines).toEqual([HELD]);
      // Still not open: the next call is a probe, and a second call beside it is refused.
      const probe = g.pending();
      expect((await rejection(g.answers())).code).toBe('unresponsive');
      expect(g.calls).toBe(3);
      probe.resolve();
      expect(await probe.settled).toBe('ok');
      expect(g.lines).toEqual([HELD, FIRST, OPEN]);
    }
  });

  it('frees the probe slot when the operation throws before returning a promise', async () => {
    const g = await probing();
    const thrown = new OmniFocusCliError('Invalid arguments', 400);
    await expect(
      g.execute(() => {
        throw thrown;
      })
    ).rejects.toBe(thrown);
    expect(await g.answers()).toBe('ok');
  });

  it('lets another call probe when a probe never settles', async () => {
    const g = await probing();
    g.pending();
    g.advance(149_000);
    expect((await rejection(g.answers())).code).toBe('unresponsive');
    g.advance(1_000);
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual([HELD, FIRST, OPEN]);
  });

  it('does not fail a call because its log line could not be written', async () => {
    const g = gate({
      log: () => {
        throw new Error('stderr closed');
      },
    });
    expect(await g.answers()).toBe('ok');
    expect((await rejection(g.fails(timeout()))).code).toBe('timeout');
  });
});
