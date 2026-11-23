import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as runtime from '../runtime.js';

const source = readFileSync(join(import.meta.dir, '..', 'runtime.ts'), 'utf8');

// The bridge ships the runtime to OmniFocus as function source text. Anything
// a function reaches outside its own body must therefore be another exported
// function in the same file; these checks keep module-level state and
// unexported helpers, which would exist in Node but not in OmniFocus, out of it.
describe('Omni Automation runtime source', () => {
  it('has no imports', () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\(/);
  });

  it('declares only exported functions and types at the top level', () => {
    const allowed = /^(export function |export type |export interface |\}|\)|\/\/|\/\*\*)/;
    const offending = source.split('\n').filter((line) => /^\S/.test(line) && !allowed.test(line));
    expect(offending).toEqual([]);
  });

  it('exports nothing but functions', () => {
    const others = Object.entries(runtime)
      .filter(([, member]) => typeof member !== 'function')
      .map(([name]) => name);
    expect(others).toEqual([]);
  });

  it('exports every function the source declares', () => {
    const declared = [...source.matchAll(/^export function (\w+)/gm)].map((match) => match[1]);
    expect(declared.length).toBeGreaterThan(50);
    expect(Object.keys(runtime).sort()).toEqual(declared.sort());
  });
});
