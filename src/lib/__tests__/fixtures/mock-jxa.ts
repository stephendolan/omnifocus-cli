import { copyFile, mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Puts a mock `osascript` first on PATH. With `omniContext`, the mock also
 * evaluates Omni Automation scripts against the seeded fake database in
 * omni-context.ts, built here for Node because the mock runs under Node.
 */
export async function mockJxaEnvironment(options: { omniContext?: boolean } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'of-mock-jxa-'));
  const executable = join(directory, 'osascript');
  await copyFile(new URL('./mock-osascript.cjs', import.meta.url), executable);
  await chmod(executable, 0o755);
  const env: Record<string, string | undefined> = {
    ...process.env,
    PATH: `${directory}:${process.env.PATH}`,
  };
  if (options.omniContext) {
    const build = await Bun.build({
      entrypoints: [join(import.meta.dir, 'omni-context.ts')],
      outdir: directory,
      target: 'node',
      format: 'cjs',
    });
    if (!build.success) throw new Error(build.logs.join('\n'));
    env.OF_TEST_OMNI_CONTEXT = join(directory, 'omni-context.js');
  }
  return {
    env,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
