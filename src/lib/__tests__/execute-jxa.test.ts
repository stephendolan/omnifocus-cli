import { describe, expect, it } from 'bun:test';
import { OmniFocus } from '../omnifocus.js';

describe.skipIf(process.platform !== 'darwin')('executeJXA', () => {
  it('reports an actionable automation timeout', async () => {
    const of = new OmniFocus();
    await expect(
      of['executeJXA']("ObjC.import('Foundation'); $.NSThread.sleepForTimeInterval(1);", 20)
    ).rejects.toThrow(
      'OmniFocus automation did not respond within 20ms. Check OmniFocus and macOS Automation permissions in this login session.'
    );
  });

  it('keeps concurrent scripts isolated', async () => {
    const of = new OmniFocus();
    const scripts = ['"a"', '"b"', '"c"', '"d"'];
    const results = await Promise.all(scripts.map((script) => of['executeJXA'](script)));
    expect(results).toEqual(['a', 'b', 'c', 'd']);
  });
});
