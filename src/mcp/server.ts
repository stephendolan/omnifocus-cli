import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Icon } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import packageJson from '../../package.json' with { type: 'json' };
import { errorResponse } from '../lib/errors.js';
import { createExecutionGate, type Execute } from '../lib/execution-gate.js';
import { OmniFocus } from '../lib/omnifocus.js';
import { isAvailable, type CapabilityMode } from './capabilities.js';
import { loadMcpIcons } from './icons.js';
import { TOOLS } from './tools.js';

export interface McpServerOptions {
  mode?: CapabilityMode;
  icons?: Icon[];
  omniFocus?: OmniFocus;
  /** Admits operations to OmniFocus. A listener shares one gate across its requests. */
  execute?: Execute;
  /** Receives one line per failed tool call and per change in bridge health. */
  log?: (message: string) => void;
}

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// Tools register here, not at module load, because `of mcp --http` builds a server per request.
export function createMcpServer(options: McpServerOptions = {}): McpServer {
  const mode = options.mode ?? 'full';
  const of = options.omniFocus ?? new OmniFocus();
  const log = options.log ?? (() => {});
  const execute = options.execute ?? createExecutionGate({ log });
  const available = TOOLS.filter((tool) => isAvailable(tool, mode));

  // Every failure reaches the client as the same typed JSON the CLI prints. The
  // log line carries the tool and the outcome, never arguments or detail, which
  // can hold the user's task text.
  async function respond<T>(tool: string, operation: () => Promise<T>) {
    const started = Date.now();
    try {
      return jsonResponse(await execute(operation));
    } catch (error) {
      const body = errorResponse(error);
      const { name, statusCode } = body.error;
      const code = 'code' in body.error ? body.error.code : name;
      const changes = 'changes' in body.error ? body.error.changes : 'unstated';
      log(
        `tool=${tool} error=${code} status=${statusCode} changes=${changes} ms=${Date.now() - started}`
      );
      return { ...jsonResponse(body), isError: true };
    }
  }

  const server = new McpServer({
    name: 'omnifocus',
    version: packageJson.version,
    icons: options.icons ?? loadMcpIcons(),
  });

  for (const tool of available) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args) => respond(tool.name, () => tool.run(of, args))
    );
  }

  server.registerTool(
    'search_tools',
    {
      description:
        'Search for available tools by name or description using regex. Returns matching tool names.',
      inputSchema: z.strictObject({
        query: z
          .string()
          .describe(
            'Regex pattern to match against tool names and descriptions (case-insensitive)'
          ),
      }),
    },
    async ({ query }) => {
      try {
        const pattern = new RegExp(query, 'i');
        const matches = available
          .filter((tool) => pattern.test(tool.name) || pattern.test(tool.description))
          .map(({ name, description }) => ({ name, description }));
        return jsonResponse({ tools: matches });
      } catch {
        return jsonResponse({ error: 'Invalid regex pattern' });
      }
    }
  );

  return server;
}

export async function runMcpServer(options: McpServerOptions = {}) {
  await createMcpServer(options).connect(new StdioServerTransport());
}
