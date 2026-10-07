import { describe, expect, it } from 'bun:test';
import { OmniFocus } from '../omnifocus.js';

describe.skipIf(process.platform !== 'darwin')('executeJXA', () => {
  it('keeps concurrent scripts isolated', async () => {
    const of = new OmniFocus();
    const scripts = ['"a"', '"b"', '"c"', '"d"'];
    const results = await Promise.all(scripts.map((script) => of['executeJXA'](script)));
    expect(results).toEqual(['a', 'b', 'c', 'd']);
  });
});
