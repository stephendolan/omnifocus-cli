import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { OmniFocus } from '../../lib/omnifocus.js';
import { fakeOmniFocus } from '../../lib/__tests__/fixtures/fake-omnifocus.js';
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
  'update_perspective_rules',
  'delete_tag',
  'create_folder',
  'delete_folder',
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
    expect(tools.length).toBe(30);
    expect(tools).toEqual(expect.arrayContaining(excluded));
    expect(client.getServerVersion()).toMatchObject({
      name: 'omnifocus',
      version: packageJson.version,
    });
  });

  for (const mode of ['full', 'read-only'] as const) {
    it(`advertises self-contained default PNG icons in ${mode} mode`, async () => {
      const client = await connect(mode);
      clients.push(client);
      const icons = client.getServerVersion()?.icons;
      expect(icons).toHaveLength(2);
      for (const [index, size] of [128, 64].entries()) {
        const icon = icons![index];
        expect(icon.mimeType).toBe('image/png');
        expect(icon.sizes).toEqual([`${size}x${size}`]);
        expect(icon.src).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
        const png = Buffer.from(icon.src.split(',')[1], 'base64');
        expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        expect(png.toString('ascii', 12, 16)).toBe('IHDR');
        expect(png.readUInt32BE(16)).toBe(size);
        expect(png.readUInt32BE(20)).toBe(size);
      }
    });
  }

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
      'get_perspective_rules',
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
            tools: [
              { name: 'list_perspectives', description: 'List all available perspectives' },
              {
                name: 'get_perspective_rules',
                description: 'Read a custom perspective rule archive as structured JSON',
              },
            ],
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
      expect(create.mock.calls).toEqual([['Work', undefined]]);
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
                    'Create or reuse a folder with an exact name under the selected parent or library root',
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

  it('exposes project ordering and nested creation through the MCP tool schemas', async () => {
    const { of } = fakeOmniFocus();
    const anchor = await of.createProject({ name: 'Anchor' });
    const moved = await of.createProject({ name: 'Moved' });
    const parent = await of.createFolder('Parent');
    const client = await connect('full', of);
    clients.push(client);
    const call = (name: string, args: Record<string, unknown>) =>
      client.callTool({ name, arguments: args });

    expect(
      await call('update_project', { idOrName: moved.id, before: anchor.id, status: 'active' })
    ).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining('Ordering cannot combine') }],
    });
    expect(
      (await call('update_project', { idOrName: moved.id, before: anchor.id })).isError
    ).toBeFalsy();
    expect((await of.listProjects()).map(({ id }) => id)).toEqual([moved.id, anchor.id]);
    expect(
      (await call('update_project', { idOrName: moved.id, after: 'Anchor' })).isError
    ).toBeFalsy();
    expect((await of.listProjects()).map(({ id }) => id)).toEqual([anchor.id, moved.id]);
    expect((await call('create_folder', { name: 'Child', parent: parent.id })).isError).toBeFalsy();
    expect(await of.listFolders()).toMatchObject([
      { id: parent.id, children: [{ name: 'Child' }] },
    ]);
  });
});
