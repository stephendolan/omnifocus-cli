import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { OmniFocus } from '../../lib/omnifocus.js';
import packageJson from '../../../package.json' with { type: 'json' };
import { createMcpServer } from '../server.js';
import type { CapabilityMode } from '../capabilities.js';

async function connect(mode: CapabilityMode = 'full', omniFocus = new OmniFocus()) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ mode, omniFocus });
  const client = new Client({ name: 'test', version: '1' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

const excluded = [
  'create_task',
  'update_task',
  'delete_task',
  'create_project',
  'update_project',
  'delete_project',
  'create_tag',
  'update_tag',
  'delete_tag',
  'get_perspective_tasks',
];

describe('capability modes', () => {
  const clients: Client[] = [];
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  it('defaults to full access and reports the package version', async () => {
    const client = await connect();
    clients.push(client);
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    expect(tools.length).toBe(26);
    expect(tools).toEqual(expect.arrayContaining(excluded));
    expect(client.getServerVersion()).toEqual({ name: 'omnifocus', version: packageJson.version });
  });

  it('enforces the read-only allowlist in listing, search, and direct calls', async () => {
    const client = await connect('read-only');
    clients.push(client);
    expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([
      'get_folder',
      'get_inbox_count',
      'get_project',
      'get_project_stats',
      'get_tag',
      'get_tag_stats',
      'get_task',
      'get_task_stats',
      'list_folders',
      'list_inbox',
      'list_perspectives',
      'list_projects',
      'list_tags',
      'list_tasks',
      'search_tasks',
      'search_tools',
    ]);
    const search = await client.callTool({
      name: 'search_tools',
      arguments: { query: 'create|update|delete|perspective' },
    });
    expect(search.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify(
          {
            tools: [{ name: 'list_perspectives', description: 'List all available perspectives' }],
          },
          null,
          2
        ),
      },
    ]);
    for (const name of excluded) {
      const result = await client.callTool({ name, arguments: {} });
      expect(result).toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining(`Tool ${name} not found`) }],
      });
    }
  });

  it('executes full-mode writes against a mocked OmniFocus operation', async () => {
    const of = new OmniFocus();
    const create = spyOn(of, 'createTask').mockResolvedValue({
      id: 'mock-task',
      name: 'Disposable',
    } as Awaited<ReturnType<OmniFocus['createTask']>>);
    const client = await connect('full', of);
    clients.push(client);
    const result = await client.callTool({
      name: 'create_task',
      arguments: { name: 'Disposable', flagged: true },
    });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ id: 'mock-task', name: 'Disposable' }, null, 2) },
    ]);
    expect(create.mock.calls).toEqual([[{ name: 'Disposable', flagged: true }]]);
    create.mockRestore();
  });
});
