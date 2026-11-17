import { copyFile, mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function mockJxaEnvironment() {
  const directory = await mkdtemp(join(tmpdir(), 'of-mock-jxa-'));
  const executable = join(directory, 'osascript');
  await copyFile(new URL('./mock-osascript.cjs', import.meta.url), executable);
  await chmod(executable, 0o755);
  return {
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
