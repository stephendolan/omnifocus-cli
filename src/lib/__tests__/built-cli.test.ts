import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { mockJxaEnvironment } from './fixtures/mock-jxa.js';

const execFileAsync = promisify(execFile);
const distCli = join(process.cwd(), 'dist', 'cli.js');

// The bridge sends OmniFocus the source text of functions as the bundler
// emitted them. These tests run that shipped text, under Node, against a fake
// database behind a mock osascript, so a bundling change that breaks the
// composed script fails here instead of inside OmniFocus.
describe('built CLI against a fake database (mock executable, no Apple events)', () => {
  let fixture: Awaited<ReturnType<typeof mockJxaEnvironment>>;

  beforeAll(async () => {
    if (!existsSync(distCli)) {
      throw new Error('dist/cli.js not found — run `bun run build` before this test suite.');
    }
    fixture = await mockJxaEnvironment({ omniContext: true });
  });
  afterAll(() => fixture.cleanup());

  async function cli(...args: string[]) {
    const result = await execFileAsync('node', [distCli, ...args], { env: fixture.env }).then(
      ({ stdout }) => ({ stdout, exitCode: 0 }),
      (error: { stdout: string; code: number }) => ({ stdout: error.stdout, exitCode: error.code })
    );
    return { exitCode: result.exitCode, json: JSON.parse(result.stdout) };
  }

  it('reads tasks, projects, tags, folders, and perspectives', async () => {
    const tasks = await cli('task', 'list');
    expect(tasks.exitCode).toBe(0);
    expect(tasks.json.map((task: { name: string }) => task.name)).toEqual([
      'Seeded project',
      'Seeded task',
      'Seeded inbox task',
    ]);
    expect((await cli('task', 'view', 'Seeded task')).json).toMatchObject({
      project: 'Seeded project',
      tags: ['Seeded tag'],
    });
    expect((await cli('inbox', 'count')).json).toEqual({ count: 1 });
    expect((await cli('search', 'inbox')).json).toMatchObject([{ name: 'Seeded inbox task' }]);
    expect((await cli('project', 'list', '--folder', 'Seeded folder')).json).toMatchObject([
      { name: 'Seeded project', folder: 'Seeded folder', taskCount: 1 },
    ]);
    expect((await cli('tag', 'list', '--sort', 'usage')).json).toMatchObject([
      { name: 'Seeded tag', taskCount: 1 },
    ]);
    expect((await cli('folder', 'list')).json).toMatchObject([
      { name: 'Seeded folder', projectCount: 1, remainingProjectCount: 1 },
    ]);
    expect((await cli('perspective', 'get-rules', 'Seeded perspective')).json).toMatchObject({
      id: 'seeded-perspective',
      definition: { archivedTopLevelFilterAggregation: 'all' },
    });
    expect((await cli('perspective', 'view', 'Seeded perspective')).json).toMatchObject([
      { name: 'Seeded task' },
    ]);
    expect((await cli('perspective', 'list')).json).toContainEqual({
      id: 'Seeded perspective',
      name: 'Seeded perspective',
      identifier: 'seeded-perspective',
    });
  });

  it('computes statistics', async () => {
    expect((await cli('task', 'stats')).json).toMatchObject({ totalTasks: 3, activeTasks: 3 });
    expect((await cli('project', 'stats')).json).toMatchObject({
      totalProjects: 1,
      projectsWithMostTasks: [{ name: 'Seeded project', taskCount: 1 }],
    });
    expect((await cli('tag', 'stats')).json).toMatchObject({ totalTags: 1, tagsWithTasks: 1 });
  });

  it('creates, updates, moves, and deletes through the verified write path', async () => {
    const created = await cli(
      'task',
      'create',
      'New "quoted" task',
      '--project',
      'Seeded project',
      '--tag',
      'Seeded tag',
      '--due',
      '2026-12-01T10:00:00Z',
      '--flagged',
      '--estimate',
      '15'
    );
    expect(created.exitCode).toBe(0);
    expect(created.json).toMatchObject({
      name: 'New "quoted" task',
      project: 'Seeded project',
      tags: ['Seeded tag'],
      due: '2026-12-01T10:00:00.000Z',
      flagged: true,
      estimatedMinutes: 15,
    });
    expect(
      (
        await cli(
          'task',
          'update',
          'Seeded task',
          '--name',
          'Renamed',
          '--project',
          '',
          '--complete'
        )
      ).json
    ).toMatchObject({ name: 'Renamed', project: null, completed: true });
    expect(
      (await cli('project', 'update', 'Seeded project', '--type', 'sequential', '--folder', ''))
        .json
    ).toMatchObject({ type: 'sequential', folder: null });
    expect(
      (
        await cli(
          'project',
          'create',
          'New list',
          '--single-action-list',
          '--folder',
          'Seeded folder'
        )
      ).json
    ).toMatchObject({ type: 'single-action', folder: 'Seeded folder' });
    expect(
      (await cli('tag', 'create', 'Child', '--parent', 'Seeded tag', '--status', 'on hold')).json
    ).toMatchObject({ parent: 'Seeded tag', status: 'on hold' });
    expect((await cli('tag', 'update', 'Seeded tag', '--status', 'dropped')).json).toMatchObject({
      status: 'dropped',
    });
    expect((await cli('folder', 'create', 'Seeded folder')).json).toMatchObject({
      alreadyExisted: true,
    });
    expect((await cli('task', 'delete', 'Seeded inbox task')).json).toMatchObject({
      message: 'Task deleted successfully',
      name: 'Seeded inbox task',
    });
    expect((await cli('project', 'delete', 'Seeded project')).json).toMatchObject({
      message: 'Project deleted successfully',
      name: 'Seeded project',
    });
    expect((await cli('tag', 'delete', 'Seeded tag')).json).toMatchObject({
      message: 'Tag deleted successfully',
      name: 'Seeded tag',
    });
    expect((await cli('folder', 'create', 'Scratch')).json).toMatchObject({
      alreadyExisted: false,
    });
  });

  it('rejects option values it used to ignore', async () => {
    // Each case names the failure it must hit, so none can pass for another reason.
    for (const [args, expected] of [
      [['project', 'list', '--status', 'paused'], { name: 'cli_error', detail: 'status: ' }],
      [['tag', 'list', '--sort', 'recent'], { name: 'cli_error', detail: 'sortBy: ' }],
      [['tag', 'list', '--unused-days', 'many'], { name: 'cli_error', detail: 'unusedDays: ' }],
      [['tag', 'list', '--unused-days', ''], { name: 'cli_error', detail: 'unusedDays: ' }],
      [
        ['task', 'update', 'Seeded task', '--name', '', '--flag'],
        { name: 'cli_error', detail: 'name: ' },
      ],
      [
        ['task', 'update', 'Seeded task', '--estimate', '2.5x'],
        { name: 'cli_error', detail: 'estimatedMinutes: ' },
      ],
      [
        ['task', 'update', 'Seeded task', '--estimate', ''],
        { name: 'cli_error', detail: 'estimatedMinutes: ' },
      ],
      [['task', 'list', '--tag', ''], { name: 'cli_error', detail: 'tag: ' }],
      [['task', 'list', '--project', ''], { name: 'cli_error', detail: 'project: ' }],
      [
        ['task', 'list', '--tag', 'No such tag'],
        { code: 'not_found', detail: 'Tag not found: No such tag' },
      ],
      [
        ['project', 'list', '--folder', 'No such folder'],
        { code: 'not_found', detail: 'Folder not found: No such folder' },
      ],
      [
        ['task', 'delete', 'Seeded project'],
        { code: 'invalid', detail: 'Seeded project is a project; delete it as a project' },
      ],
      [
        ['task', 'update', 'Seeded project', '--complete'],
        { code: 'invalid', detail: 'Seeded project is a project; complete or drop it' },
      ],
    ] as const) {
      const result = await cli(...args);
      expect(result.exitCode).toBe(1);
      const { detail, ...fields } = expected;
      expect(result.json.error).toMatchObject({ ...fields, changes: 'none' });
      expect(result.json.error.detail).toContain(detail);
    }
  });

  it('exits unsuccessfully with a typed error', async () => {
    expect(await cli('task', 'view', 'Missing')).toEqual({
      exitCode: 1,
      json: {
        error: {
          name: 'omnifocus_error',
          detail: 'Task not found: Missing',
          statusCode: 404,
          code: 'not_found',
          changes: 'none',
        },
      },
    });
    expect(await cli('folder', 'delete', 'Seeded folder')).toEqual({
      exitCode: 1,
      json: {
        error: {
          name: 'omnifocus_error',
          detail: 'Folder must be empty to delete',
          statusCode: 400,
          code: 'invalid',
          changes: 'none',
        },
      },
    });
    expect((await cli('task', 'update', 'Seeded task', '--due', 'not a date')).json).toEqual({
      error: {
        name: 'cli_error',
        detail: 'Invalid date: not a date',
        statusCode: 400,
        changes: 'none',
      },
    });
  });
});
