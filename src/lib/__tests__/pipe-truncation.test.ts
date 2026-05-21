import { describe, it, expect, beforeAll } from 'vitest';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * End-to-end regression tests for issue #20: stdout truncated to 512 bytes
 * when piped. The root cause was the `#!/usr/bin/env bun` shebang — bun's
 * runtime drops queued stdout writes when the process exits, while node
 * drains them. These tests exercise the *built* artifact under its real
 * shebang and pipe its stdout through `cat` so any drain race surfaces.
 *
 * If you bump shebang or commander exit handling and these fail, look at
 * src/cli.ts before chasing anything else.
 */

const execFileAsync = promisify(execFile);
const distCli = join(process.cwd(), 'dist', 'cli.js');

async function pipedStdoutLength(args: string[]): Promise<number> {
  // Spawn the cli, pipe through cat, count bytes the consumer actually receives.
  return new Promise((resolve, reject) => {
    const cli = spawn(distCli, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const cat = spawn('cat', [], { stdio: ['pipe', 'pipe', 'inherit'] });

    cli.stdout.pipe(cat.stdin);
    cli.on('error', reject);

    let bytes = 0;
    cat.stdout.on('data', (chunk) => {
      bytes += chunk.length;
    });
    cat.on('error', reject);
    cat.on('close', () => resolve(bytes));
  });
}

describe('pipe truncation regression (issue #20)', () => {
  beforeAll(() => {
    if (!existsSync(distCli)) {
      throw new Error(
        `dist/cli.js not found — run \`bun run build\` before this test suite.`
      );
    }
  });

  it('ships a node shebang, not bun', () => {
    // bun drops queued stdout writes on exit; node drains them.
    const firstLine = readFileSync(distCli, 'utf8').split('\n', 1)[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });

  it('--help survives a pipe (>512 byte help text not truncated)', async () => {
    // Reference length: what `--help` writes when stdout is *not* a pipe.
    const { stdout: direct } = await execFileAsync(distCli, ['--help']);
    expect(direct.length).toBeGreaterThan(512); // sanity: payload exceeds pipe buffer
    const piped = await pipedStdoutLength(['--help']);
    expect(piped).toBe(direct.length);
  });

  it('--version survives a pipe', async () => {
    const { stdout: direct } = await execFileAsync(distCli, ['--version']);
    const piped = await pipedStdoutLength(['--version']);
    expect(piped).toBe(direct.length);
  });
});
