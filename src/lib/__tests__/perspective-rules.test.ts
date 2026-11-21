import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { OmniFocus } from '../omnifocus.js';
import { parsePerspectiveRules, type PerspectiveRulesDefinition } from '../perspective-rules.js';
import { createPerspectiveCommand } from '../../commands/perspective.js';
import { createMcpServer } from '../../mcp/server.js';

const definition: PerspectiveRulesDefinition = {
  archivedFilterRules: [
    {
      aggregateType: 'any',
      aggregateRules: [
        { actionAvailability: 'available' },
        { aggregateType: 'none', aggregateRules: [{ actionHasAnyOfTags: ['tag-1'] }] },
      ],
      extension: { enabled: true, limit: 7, nullable: null },
    },
    { actionMatchingSearch: ['quoted " \\ \n\t\r "); throw new Error("injected"); //'] },
  ],
  archivedTopLevelFilterAggregation: 'all',
};

function perspectiveDatabase() {
  const perspectives = [
    { identifier: 'perspective-1', name: 'Example', ...structuredClone(definition) },
  ];
  const of = new OmniFocus();
  const execute = mock(async (script: string) =>
    runInNewContext(script, {
      ObjC: { import() {}, bindFunction() {} },
      $: {
        NSAppleEventDescriptor: { descriptorWithBundleIdentifier: () => ({ aeDesc: {} }) },
        AEDeterminePermissionToAutomateTarget: () => 0,
      },
      Application: () => ({
        evaluateJavascript: (omniScript: string) =>
          runInNewContext(omniScript, {
            Perspective: {
              Custom: {
                all: perspectives,
                byIdentifier: (id: string) => perspectives.find((p) => p.identifier === id) ?? null,
              },
              BuiltIn: { all: [{ name: 'Localized Inbox' }] },
            },
          }),
      }),
    })
  );
  of['executeJXA'] = execute;
  return { of, perspectives, execute };
}

describe('perspective rule archives', () => {
  it('reads by name or identifier and round trips nested and unknown archive fields', async () => {
    const { of } = perspectiveDatabase();
    const before = await of.getPerspectiveRules('Example');
    expect(before).toEqual({ id: 'perspective-1', name: 'Example', definition });
    expect(await of.updatePerspectiveRules(before.id, before.definition)).toEqual(before);
    expect(await of.getPerspectiveRules(before.id)).toEqual(before);
  });

  it('replaces the full rule tree and aggregation, including empty rules and null aggregation', async () => {
    const { of } = perspectiveDatabase();
    const replacement = { archivedFilterRules: [], archivedTopLevelFilterAggregation: null };
    expect(await of.updatePerspectiveRules('Example', replacement)).toEqual({
      id: 'perspective-1',
      name: 'Example',
      definition: replacement,
    });
    expect((await of.getPerspectiveRules('Example')).definition).toEqual(replacement);
  });

  it('rejects built-ins and missing perspectives without changing the database', async () => {
    const { of, perspectives } = perspectiveDatabase();
    for (const name of ['Inbox', 'inbox', 'Search', 'Localized Inbox']) {
      await expect(of.getPerspectiveRules(name)).rejects.toThrow('no editable rules');
      await expect(of.updatePerspectiveRules(name, definition)).rejects.toThrow(
        'no editable rules'
      );
    }
    await expect(of.getPerspectiveRules('Missing')).rejects.toThrow('Perspective not found');
    expect(perspectives).toEqual([{ identifier: 'perspective-1', name: 'Example', ...definition }]);
  });

  it('rejects ambiguous names while allowing an explicit identifier and custom built-in names', async () => {
    const { of, perspectives } = perspectiveDatabase();
    perspectives.push({
      identifier: 'perspective-2',
      name: 'Example',
      ...structuredClone(definition),
    });
    await expect(of.getPerspectiveRules('Example')).rejects.toThrow('Multiple');
    await expect(of.updatePerspectiveRules('Example', definition)).rejects.toThrow('Multiple');
    expect((await of.getPerspectiveRules('perspective-2')).id).toBe('perspective-2');
    perspectives[1].name = 'Inbox';
    expect((await of.getPerspectiveRules('Inbox')).id).toBe('perspective-2');
  });

  it('round trips perspective names with script syntax as data', async () => {
    const { of, perspectives } = perspectiveDatabase();
    const name = '" \\ \n\r\t "); throw new Error("injected"); //';
    perspectives[0].name = name;
    expect((await of.getPerspectiveRules(name)).name).toBe(name);
    expect((await of.updatePerspectiveRules(name, definition)).name).toBe(name);
  });

  it('rejects malformed structures before contacting OmniFocus', async () => {
    const { of, execute } = perspectiveDatabase();
    for (const input of [
      null,
      {},
      { ...definition, layoutMode: 'fluid' },
      { ...definition, archivedTopLevelFilterAggregation: 'invalid' },
      { ...definition, archivedFilterRules: '[]' },
      { ...definition, archivedFilterRules: [null] },
      { ...definition, archivedFilterRules: [{}] },
      { ...definition, archivedFilterRules: [{ aggregateType: 'all' }] },
      { ...definition, archivedFilterRules: [{ aggregateType: 'invalid', aggregateRules: [] }] },
      { ...definition, archivedFilterRules: [{ aggregateType: 'all', aggregateRules: [{}] }] },
    ]) {
      expect(() => parsePerspectiveRules(input)).toThrow('Invalid perspective rules');
      await expect(
        of.updatePerspectiveRules('Example', input as PerspectiveRulesDefinition)
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(execute).not.toHaveBeenCalled();
  });

  for (const failedProperty of [
    'archivedFilterRules',
    'archivedTopLevelFilterAggregation',
  ] as const) {
    it(`restores the original after ${failedProperty} mutates and then throws`, async () => {
      const { of, perspectives } = perspectiveDatabase();
      let value: unknown = perspectives[0][failedProperty];
      let fail = true;
      Object.defineProperty(perspectives[0], failedProperty, {
        get: () => value,
        set: (next) => {
          value = next;
          if (fail) {
            fail = false;
            throw new Error('OmniFocus rejected archive');
          }
        },
        enumerable: true,
      });
      const replacement = {
        archivedFilterRules: [],
        archivedTopLevelFilterAggregation: 'none' as const,
      };
      await expect(of.updatePerspectiveRules('Example', replacement)).rejects.toThrow(
        'OmniFocus rejected archive'
      );
      expect((await of.getPerspectiveRules('Example')).definition).toEqual(definition);
    });
  }

  it('detects silent archive normalization and restores the original', async () => {
    const { of, perspectives } = perspectiveDatabase();
    let value = perspectives[0].archivedFilterRules;
    Object.defineProperty(perspectives[0], 'archivedFilterRules', {
      get: () => value,
      set: (next) => {
        value = next.length ? next : [{ actionIsLeaf: true }];
      },
    });
    await expect(
      of.updatePerspectiveRules('Example', {
        archivedFilterRules: [],
        archivedTopLevelFilterAggregation: 'any',
      })
    ).rejects.toThrow('did not retain');
    expect((await of.getPerspectiveRules('Example')).definition).toEqual(definition);
  });

  it('restores rules even when the changed archive getter throws', async () => {
    const { of, perspectives } = perspectiveDatabase();
    let value = perspectives[0].archivedFilterRules;
    Object.defineProperty(perspectives[0], 'archivedFilterRules', {
      get: () => {
        if (!value.length) throw new Error('Cannot read changed archive');
        return value;
      },
      set: (next) => {
        value = next;
      },
    });
    await expect(
      of.updatePerspectiveRules('Example', {
        archivedFilterRules: [],
        archivedTopLevelFilterAggregation: 'any',
      })
    ).rejects.toThrow('Cannot read changed archive');
    expect((await of.getPerspectiveRules('Example')).definition).toEqual(definition);
  });

  it('rejects JSON keys that the schema library would silently discard', async () => {
    const { of, execute } = perspectiveDatabase();
    const input = JSON.parse(
      '{"archivedFilterRules":[{"extension":{"__proto__":{"enabled":true}}}],"archivedTopLevelFilterAggregation":"all"}'
    );
    await expect(of.updatePerspectiveRules('Example', input)).rejects.toThrow(
      '__proto__ is unsupported'
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('reports rollback failure instead of claiming that a partial write succeeded', async () => {
    const { of, perspectives } = perspectiveDatabase();
    let value = perspectives[0].archivedFilterRules;
    let writes = 0;
    Object.defineProperty(perspectives[0], 'archivedFilterRules', {
      get: () => value,
      set: (next) => {
        if (writes++ > 0) throw new Error('Setter unavailable');
        value = next;
      },
    });
    Object.defineProperty(perspectives[0], 'archivedTopLevelFilterAggregation', {
      get: () => 'all',
      set: () => {
        throw new Error('Aggregation unavailable');
      },
    });
    await expect(
      of.updatePerspectiveRules('Example', {
        archivedFilterRules: [],
        archivedTopLevelFilterAggregation: 'any',
      })
    ).rejects.toThrow(
      'Aggregation unavailable; perspective rules rollback failed: archivedFilterRules: Setter unavailable'
    );
  });

  it('propagates bridge errors and rejects unsupported archives', async () => {
    const { of, execute, perspectives } = perspectiveDatabase();
    Object.defineProperty(perspectives[0], 'archivedFilterRules', { value: undefined });
    await expect(of.getPerspectiveRules('Example')).rejects.toThrow(
      'unsupported perspective rules archive'
    );
    execute.mockRejectedValue(new Error('Automation failed'));
    await expect(of.getPerspectiveRules('Example')).rejects.toThrow('Automation failed');
    await expect(of.updatePerspectiveRules('Example', definition)).rejects.toThrow(
      'Automation failed'
    );
  });

  it('reads and applies a JSON definition file through the CLI', async () => {
    const { of } = perspectiveDatabase();
    const result = await of.getPerspectiveRules('Example');
    const read = spyOn(OmniFocus.prototype, 'getPerspectiveRules').mockResolvedValue(result);
    const update = spyOn(OmniFocus.prototype, 'updatePerspectiveRules').mockResolvedValue(result);
    const output = spyOn(console, 'log').mockImplementation(() => {});
    const directory = await mkdtemp(join(tmpdir(), 'of-rules-'));
    try {
      const file = join(directory, 'definition.json');
      await writeFile(file, JSON.stringify(definition));
      await createPerspectiveCommand().parseAsync(['get-rules', 'Example'], { from: 'user' });
      await createPerspectiveCommand().parseAsync(['update-rules', 'Example', '--file', file], {
        from: 'user',
      });
      expect(read.mock.calls).toEqual([['Example']]);
      expect(update.mock.calls).toEqual([['Example', definition]]);
      expect(output.mock.calls).toEqual([
        [JSON.stringify(result, null, 2)],
        [JSON.stringify(result, null, 2)],
      ]);
    } finally {
      read.mockRestore();
      update.mockRestore();
      output.mockRestore();
      await rm(directory, { recursive: true });
    }
  });
});

describe('perspective rule MCP tools', () => {
  const clients: Client[] = [];
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
  });

  async function connect(mode: 'full' | 'read-only') {
    const { of } = perspectiveDatabase();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createMcpServer({ mode, omniFocus: of }).connect(serverTransport);
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(clientTransport);
    clients.push(client);
    return client;
  }

  it('round trips the archive through full-mode MCP calls and returns failures as errors', async () => {
    const client = await connect('full');
    const read = await client.callTool({
      name: 'get_perspective_rules',
      arguments: { idOrName: 'Example' },
    });
    expect(read.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify({ id: 'perspective-1', name: 'Example', definition }, null, 2),
      },
    ]);
    const updated = await client.callTool({
      name: 'update_perspective_rules',
      arguments: { idOrName: 'perspective-1', definition },
    });
    expect(updated).toEqual(read);
    expect(
      await client.callTool({ name: 'get_perspective_rules', arguments: { idOrName: 'Inbox' } })
    ).toMatchObject({ isError: true });
    expect(
      await client.callTool({
        name: 'update_perspective_rules',
        arguments: { idOrName: 'Example', definition: {} },
      })
    ).toMatchObject({ isError: true });
    expect(
      await client.callTool({
        name: 'update_perspective_rules',
        arguments: {
          idOrName: 'Example',
          definition: JSON.parse(
            '{"archivedFilterRules":[{"extension":{"__proto__":true}}],"archivedTopLevelFilterAggregation":"all"}'
          ),
        },
      })
    ).toMatchObject({ isError: true });
  });

  it('permits reading in read-only mode and rejects direct updates', async () => {
    const client = await connect('read-only');
    expect(
      await client.callTool({ name: 'get_perspective_rules', arguments: { idOrName: 'Example' } })
    ).not.toHaveProperty('isError', true);
    expect(
      await client.callTool({
        name: 'update_perspective_rules',
        arguments: { idOrName: 'Example', definition },
      })
    ).toMatchObject({ isError: true });
    expect(
      await client.callTool({ name: 'get_perspective_rules', arguments: { idOrName: 'Example' } })
    ).toMatchObject({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ id: 'perspective-1', name: 'Example', definition }, null, 2),
        },
      ],
    });
  });
});
