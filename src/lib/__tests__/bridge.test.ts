import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { composeOmniScript as compose, decodeOmniResult, runOsascript } from '../bridge.js';
import { AutomationPermissionError } from '../consent.js';
import { OmniFocusError } from '../errors.js';
import { mockJxaEnvironment } from './fixtures/mock-jxa.js';

function decodeFailure(output: string): OmniFocusError {
  try {
    decodeOmniResult(output);
  } catch (error) {
    return error as OmniFocusError;
  }
  throw new Error('Expected decodeOmniResult to throw');
}

describe('composeOmniScript', () => {
  const echo = (args: unknown) => args;
  const composeOmniScript = <A>(operation: (args: A) => unknown, args: A) =>
    compose(operation, args, Date.now() + 60_000);

  it('passes arguments as data, whatever characters and keys they hold', () => {
    const args = {
      text: '"); throw new Error("injected"); // \\ \n\r\t   ${1} `',
      nested: [{ ['__proto__']: 'kept as a key' }],
    };
    const result = decodeOmniResult<typeof args>(runInNewContext(composeOmniScript(echo, args)));
    expect(result.text).toBe(args.text);
    expect(Object.keys(result.nested[0])).toEqual(['__proto__']);
    expect(Object.getOwnPropertyDescriptor(result.nested[0], '__proto__')?.value).toBe(
      'kept as a key'
    );
  });

  it('runs an operation that takes no arguments', () => {
    expect(decodeOmniResult(runInNewContext(composeOmniScript(() => 7, undefined)))).toBe(7);
  });

  it('reports a thrown value as a script error naming what was thrown', () => {
    const boom = () => {
      throw new TypeError('no such member');
    };
    const error = decodeFailure(runInNewContext(composeOmniScript(boom, undefined)));
    expect(error).toMatchObject({
      code: 'script_error',
      statusCode: 500,
      message: 'OmniFocus script error: TypeError: no such member',
    });
    const text = () => {
      throw 'plain text';
    };
    expect(decodeFailure(runInNewContext(composeOmniScript(text, undefined))).message).toBe(
      'OmniFocus script error: Error: plain text'
    );
  });

  it('does not run an operation whose deadline has passed', () => {
    const sandbox = { ran: false };
    const mark = new Function('ran = true; return 1') as () => number;
    const expired = decodeFailure(
      runInNewContext(compose(mark, undefined, Date.now() - 1), sandbox)
    );
    expect(expired).toMatchObject({
      code: 'expired',
      statusCode: 504,
      changes: 'none',
      message: 'The request expired before OmniFocus ran it; nothing was changed',
    });
    expect(sandbox.ran).toBe(false);
    expect(
      decodeOmniResult<number>(
        runInNewContext(compose(mark, undefined, Date.now() + 60_000), sandbox)
      )
    ).toBe(1);
    expect(sandbox.ran).toBe(true);
  });

  it('reports a name OmniFocus does not provide as a script error', () => {
    // A stand-in for runtime code that calls an Omni Automation function that does not exist.
    const error = decodeFailure(
      runInNewContext(
        composeOmniScript(new Function('return moveProjects()') as () => void, undefined)
      )
    );
    expect(error.code).toBe('script_error');
    expect(error.message).toContain('ReferenceError');
    expect(error.message).toContain('moveProjects');
  });
});

describe('decodeOmniResult', () => {
  it('returns the value of a successful envelope, including an absent one', () => {
    expect(decodeOmniResult<number[]>('{"ok":true,"value":[1,2]}')).toEqual([1, 2]);
    expect(decodeOmniResult('{"ok":true}')).toBeUndefined();
  });

  it('maps each failure code to its status', () => {
    for (const [code, statusCode] of [
      ['not_found', 404],
      ['ambiguous', 400],
      ['invalid', 400],
      ['verification_failed', 500],
      ['partial_write', 500],
    ] as const) {
      const error = decodeFailure(
        JSON.stringify({ ok: false, error: { code, name: 'Error', message: 'detail' } })
      );
      expect(error).toMatchObject({ code, statusCode, message: 'detail' });
    }
  });

  it('takes what a failure changed from the envelope, or from the code when it is silent', () => {
    const failed = (error: object) => decodeFailure(JSON.stringify({ ok: false, error }));
    const base = { name: 'Error', message: 'detail' };
    expect(failed({ ...base, code: 'not_found' }).changes).toBe('none');
    expect(failed({ ...base, code: 'verification_failed' }).changes).toBe('none');
    expect(failed({ ...base, code: 'partial_write' }).changes).toBe('partial');
    expect(failed({ ...base, code: 'script_error' }).changes).toBe('unknown');
    expect(failed({ ...base, code: 'script_error', changes: 'none' }).changes).toBe('none');
    expect(failed({ ...base, code: 'script_error', changes: 'everything' }).changes).toBe(
      'unknown'
    );
  });

  it('treats an unknown failure code as a script error', () => {
    const error = decodeFailure(
      JSON.stringify({ ok: false, error: { code: 'toString', name: 'Odd', message: 'detail' } })
    );
    expect(error).toMatchObject({
      code: 'script_error',
      message: 'OmniFocus script error: Odd: detail',
    });
  });

  it('rejects output that is not an envelope', () => {
    for (const output of ['', 'undefined', '[]', '{"value":1}', '{"ok":false}', 'null']) {
      expect(decodeFailure(output)).toMatchObject({ code: 'bridge_error', statusCode: 502 });
    }
  });
});

describe('runOsascript (mock executable, no Apple events)', () => {
  const originalPath = process.env.PATH;
  let fixture: Awaited<ReturnType<typeof mockJxaEnvironment>>;
  beforeAll(async () => {
    fixture = await mockJxaEnvironment();
    process.env.PATH = fixture.env.PATH;
  });
  afterAll(async () => {
    process.env.PATH = originalPath;
    await fixture.cleanup();
  });

  async function failure(promise: Promise<unknown>) {
    return promise.then(
      () => {
        throw new Error('Expected a rejection');
      },
      (error: unknown) => error
    );
  }

  it('reports an actionable automation timeout', async () => {
    const error = await failure(
      runOsascript("ObjC.import('Foundation'); $.NSThread.sleepForTimeInterval(1);", 20)
    );
    expect(error).toBeInstanceOf(OmniFocusError);
    expect(error).toMatchObject({
      code: 'timeout',
      statusCode: 504,
      message:
        'OmniFocus automation did not respond within 20ms. Check OmniFocus and macOS Automation permissions in this login session.',
    });
  });

  it('keeps concurrent scripts isolated', async () => {
    const scripts = ['"a"', '"b"', '"c"', '"d"'];
    expect(await Promise.all(scripts.map((script) => runOsascript(script)))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('reports oversized output as too large, not as a timeout', async () => {
    const error = await failure(runOsascript('"x".repeat(11 * 1024 * 1024)'));
    expect(error).toMatchObject({
      code: 'bridge_error',
      message: 'OmniFocus returned more than 10 MB. Narrow the request.',
    });
  });

  it('reports a script that osascript cannot run with its stderr', async () => {
    const error = await failure(runOsascript('this is not JavaScript'));
    expect(error).toBeInstanceOf(OmniFocusError);
    expect(error).toMatchObject({ code: 'bridge_error', statusCode: 502 });
    expect((error as Error).message).toStartWith('osascript failed: SyntaxError');
    expect((error as Error).message).not.toContain('Command failed');
  });

  it('reports a failed consent preflight as a permission error', async () => {
    const error = await failure(runOsascript("throw new Error('OF_AUTOMATION_PERMISSION:-1743')"));
    expect(error).toBeInstanceOf(AutomationPermissionError);
    expect(error).toMatchObject({ osStatus: -1743, statusCode: 403 });
  });
});
