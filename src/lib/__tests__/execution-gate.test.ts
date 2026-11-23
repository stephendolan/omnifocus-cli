import { describe, expect, it } from 'bun:test';
import { OmniFocusCliError, OmniFocusError } from '../errors.js';
import { createExecutionGate } from '../execution-gate.js';

function gate(options: { maxConcurrent?: number } = {}) {
  let time = 1_000_000;
  const lines: string[] = [];
  const execute = createExecutionGate({
    ...options,
    cooldownMs: 30_000,
    now: () => time,
    log: (line) => lines.push(line),
  });
  let calls = 0;
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

describe('execution gate', () => {
  it('passes results and failures through while OmniFocus answers', async () => {
    const g = gate();
    expect(await g.answers()).toBe('ok');
    expect(await rejection(g.fails(new OmniFocusError('not_found', 'missing')))).toMatchObject({
      code: 'not_found',
    });
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual([]);
  });

  it('rejects calls beyond its capacity without running them', async () => {
    const g = gate({ maxConcurrent: 2 });
    const releases: Array<() => void> = [];
    const blocked = () => g.execute(() => new Promise<void>((resolve) => releases.push(resolve)));
    const running = [blocked(), blocked()];
    expect(await rejection(g.answers())).toMatchObject({
      code: 'busy',
      statusCode: 503,
      changes: 'none',
    });
    expect(g.calls).toBe(0);
    releases.forEach((release) => release());
    await Promise.all(running);
    expect(await g.answers()).toBe('ok');
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
    expect(await g.answers()).toBe('ok');
    expect(g.lines).toEqual(['bridge=unresponsive holding calls for 30s', 'bridge=responding']);
  });

  it('admits only one call while it finds out whether OmniFocus answers again', async () => {
    const g = gate();
    await rejection(g.fails(timeout()));
    g.advance(30_000);
    let release!: () => void;
    const probe = g.execute(() => new Promise<void>((resolve) => (release = resolve)));
    expect(await rejection(g.answers())).toMatchObject({ code: 'unresponsive' });
    expect(g.calls).toBe(1);
    release();
    await probe;
    expect(await g.answers()).toBe('ok');
  });

  it('holds again when the call it let through also times out', async () => {
    const g = gate();
    await rejection(g.fails(timeout()));
    g.advance(30_000);
    await rejection(g.fails(timeout()));
    expect(await rejection(g.answers())).toMatchObject({ code: 'unresponsive' });
    g.advance(30_000);
    expect(await g.answers()).toBe('ok');
    expect(g.calls).toBe(3);
  });

  it('does not extend a hold when calls already in flight time out', async () => {
    const g = gate();
    const rejects: Array<(error: Error) => void> = [];
    const inFlight = [0, 1, 2].map(() =>
      rejection(g.execute(() => new Promise<void>((_, reject) => rejects.push(reject))))
    );
    rejects[0](timeout());
    await inFlight[0];
    g.advance(20_000);
    rejects[1](timeout());
    rejects[2](timeout());
    await Promise.all(inFlight);
    g.advance(10_000);
    expect(await g.answers()).toBe('ok');
    expect(g.lines.filter((line) => line.startsWith('bridge=unresponsive')).length).toBe(1);
  });

  it('reopens as soon as any call in flight is answered', async () => {
    const g = gate();
    let resolve!: () => void;
    const slow = g.execute(() => new Promise<void>((done) => (resolve = done)));
    await rejection(g.fails(timeout()));
    expect(await rejection(g.answers())).toMatchObject({ code: 'unresponsive' });
    resolve();
    await slow;
    expect(await g.answers()).toBe('ok');
  });

  it('treats an answer from OmniFocus as proof of life, and other failures as no evidence', async () => {
    for (const code of [
      'not_found',
      'invalid',
      'partial_write',
      'script_error',
      'expired',
    ] as const) {
      const g = gate();
      await rejection(g.fails(timeout()));
      g.advance(30_000);
      await rejection(g.fails(new OmniFocusError(code, 'answered')));
      expect(await g.answers()).toBe('ok');
    }
    for (const error of [
      new OmniFocusCliError('Invalid arguments', 400),
      new OmniFocusError('bridge_error', 'osascript failed'),
      new Error('unexpected'),
    ]) {
      const g = gate();
      await rejection(g.fails(timeout()));
      g.advance(30_000);
      await rejection(g.fails(error));
      // The hold has lapsed, so the next call is admitted to find out.
      await rejection(g.fails(timeout()));
      expect(await rejection(g.answers())).toMatchObject({ code: 'unresponsive' });
    }
  });
});
