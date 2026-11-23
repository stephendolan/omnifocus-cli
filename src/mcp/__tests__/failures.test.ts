import { afterEach, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { OmniFocusError } from '../../lib/errors.js';
import { fakeOmniFocus } from '../../lib/__tests__/fixtures/fake-omnifocus.js';
import { createMcpServer } from '../server.js';

describe('MCP tool failures', () => {
  const clients: Client[] = [];
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  async function connect() {
    const fake = fakeOmniFocus();
    const lines: string[] = [];
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({ omniFocus: fake.of, log: (line) => lines.push(line) });
    const client = new Client({ name: 'test', version: '1' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    clients.push(client);
    async function call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const [{ text }] = result.content as { text: string }[];
      return { isError: result.isError === true, body: JSON.parse(text) };
    }
    return { ...fake, call, lines };
  }

  it('returns a missing object as the typed error the CLI prints', async () => {
    const { call } = await connect();
    expect(await call('get_task', { idOrName: 'Secret plan' })).toEqual({
      isError: true,
      body: {
        error: {
          name: 'omnifocus_error',
          detail: 'Task not found: Secret plan',
          statusCode: 404,
          code: 'not_found',
          changes: 'none',
        },
      },
    });
  });

  it('returns arguments the library rejects as a typed error', async () => {
    const { call, Task, execute } = await connect();
    const task = new Task('Task');
    expect(await call('update_task', { idOrName: task.id.primaryKey })).toEqual({
      isError: true,
      body: {
        error: {
          name: 'cli_error',
          detail: 'An update requires at least one supported change',
          statusCode: 400,
          changes: 'none',
        },
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('says a write that failed verification changed nothing, and a failed undo left it partial', async () => {
    const { call, Project, Task, context } = await connect();
    const task = new Task('Task', new Project('Home'));
    context.moveTasks = () => {};
    const restored = await call('update_task', { idOrName: task.id.primaryKey, project: null });
    expect(restored.body.error).toMatchObject({
      code: 'verification_failed',
      detail: 'Write verification failed: project',
      changes: 'none',
    });

    Object.defineProperty(task, 'flagged', {
      get: () => false,
      set: (value) => {
        if (!value) throw new Error('Unflag refused');
      },
    });
    const partial = await call('update_task', {
      idOrName: task.id.primaryKey,
      flagged: true,
      project: null,
    });
    expect(partial.body.error).toMatchObject({ code: 'partial_write', changes: 'partial' });
  });

  it('says an unexpected failure that was fully undone changed nothing', async () => {
    const { call, Project, Task, context } = await connect();
    const task = new Task('Task', new Project('Home'));
    const move = context.moveTasks;
    context.moveTasks = () => {
      context.moveTasks = move;
      throw new TypeError('moveTasks is unavailable');
    };
    const result = await call('update_task', {
      idOrName: task.id.primaryKey,
      name: 'Renamed',
      project: null,
    });
    expect(result.body.error).toMatchObject({
      code: 'script_error',
      detail: 'OmniFocus script error: TypeError: moveTasks is unavailable',
      changes: 'none',
    });
    expect(task.name).toBe('Task');
  });

  it('labels a timed-out write as unknown and a timed-out read as unchanged', async () => {
    for (const [tool, args, changes] of [
      ['create_task', { name: 'Task' }, 'unknown'],
      ['get_inbox_count', {}, 'none'],
    ] as const) {
      const { call, execute } = await connect();
      execute.mockRejectedValue(new OmniFocusError('timeout', 'OmniFocus did not respond.'));
      const result = await call(tool, args);
      expect(result.isError).toBe(true);
      expect(result.body.error).toMatchObject({ code: 'timeout', statusCode: 504, changes });
      expect(result.body.error.detail.includes('read the object back before retrying')).toBe(
        changes === 'unknown'
      );
    }
  });

  it('stops sending calls to OmniFocus after a timeout', async () => {
    const { call, execute, lines } = await connect();
    execute.mockRejectedValue(new OmniFocusError('timeout', 'OmniFocus did not respond.'));
    await call('list_inbox');
    const held = await call('create_task', { name: 'Task' });
    expect(held.body.error).toMatchObject({
      code: 'unresponsive',
      statusCode: 503,
      changes: 'none',
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(lines).toEqual([
      'bridge=unresponsive holding calls for 30s',
      expect.stringMatching(/^tool=list_inbox error=timeout status=504 changes=none ms=\d+$/),
      expect.stringMatching(/^tool=create_task error=unresponsive status=503 changes=none ms=\d+$/),
    ]);
  });

  it('logs the tool and outcome of a failure without its arguments or detail', async () => {
    const { call, lines } = await connect();
    await call('get_task', { idOrName: 'Secret plan' });
    await call('list_inbox');
    expect(lines).toEqual([
      expect.stringMatching(/^tool=get_task error=not_found status=404 changes=none ms=\d+$/),
    ]);
  });
});
