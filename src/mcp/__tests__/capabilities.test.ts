import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { OmniFocus } from '../../lib/omnifocus.js';
import { AutomationPermissionError } from '../../lib/consent.js';
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
  'create_folder',
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
    expect(tools.length).toBe(27);
    expect(tools).toEqual(expect.arrayContaining(excluded));
    expect(client.getServerVersion()).toEqual({ name: 'omnifocus', version: packageJson.version });
  });

  for (const status of [-1744, -1743]) {
    it(`returns typed consent errors through MCP for ${status}`, async () => {
      const of = new OmniFocus();
      const list = spyOn(of, 'listPerspectives').mockRejectedValue(
        new AutomationPermissionError(status)
      );
      const count = spyOn(of, 'getInboxCount').mockRejectedValue(
        new AutomationPermissionError(status)
      );
      const remove = spyOn(of, 'deleteTask').mockRejectedValue(
        new AutomationPermissionError(status)
      );
      const client = await connect('full', of);
      clients.push(client);
      try {
        for (const [name, args] of [
          ['list_perspectives', {}],
          ['get_inbox_count', {}],
          ['delete_task', { idOrName: 'mock' }],
        ] as const) {
          const result = await client.callTool({ name, arguments: args });
          expect(result.isError).toBe(true);
          const content = result.content as { type: string; text: string }[];
          expect(JSON.parse(content[0].text).error).toMatchObject({
            name: status === -1744 ? 'automation_consent_required' : 'automation_denied',
            statusCode: 403,
            osStatus: status,
            execPath: process.execPath,
          });
        }
      } finally {
        list.mockRestore();
        count.mockRestore();
        remove.mockRestore();
      }
    });
  }

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

  it('creates folders in full mode and advertises them in search', async () => {
    const of = new OmniFocus();
    const folder = {
      id: 'folder-1',
      name: 'Work',
      status: 'active' as const,
      effectivelyActive: true,
      parent: null,
      projectCount: 0,
      remainingProjectCount: 0,
      folderCount: 0,
      children: [],
      alreadyExisted: false,
    };
    const create = spyOn(of, 'createFolder').mockResolvedValue(folder);
    try {
      const client = await connect('full', of);
      clients.push(client);
      const result = await client.callTool({ name: 'create_folder', arguments: { name: 'Work' } });
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(folder, null, 2) }]);
      expect(create.mock.calls).toEqual([['Work']]);
      const search = await client.callTool({
        name: 'search_tools',
        arguments: { query: '^create_folder$' },
      });
      expect(search.content).toEqual([
        {
          type: 'text',
          text: JSON.stringify(
            {
              tools: [
                {
                  name: 'create_folder',
                  description:
                    'Create a top-level folder, or return an existing folder with the same name',
                },
              ],
            },
            null,
            2
          ),
        },
      ]);
    } finally {
      create.mockRestore();
    }
  });
});
