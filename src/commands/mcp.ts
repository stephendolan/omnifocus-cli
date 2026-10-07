import type { AddressInfo } from 'node:net';
import { Command, InvalidArgumentError } from 'commander';
import { withErrorHandling } from '../lib/command-utils.js';
import { runMcpHttpServer } from '../mcp/http.js';
import { runMcpServer } from '../mcp/server.js';

const DEFAULT_HTTP_PORT = 3939;

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new InvalidArgumentError('Port must be an integer from 0 to 65535.');
  }
  return port;
}

export function createMcpCommand(): Command {
  return new Command('mcp')
    .description('Run OmniFocus MCP server over stdio, or over HTTP with --http')
    .option(
      '--http [port]',
      `Serve Streamable HTTP at http://127.0.0.1:<port>/mcp (default ${DEFAULT_HTTP_PORT}; 0 picks a free port)`,
      parsePort
    )
    .option(
      '--allow-host <hostnames...>',
      'Also accept these Host names over HTTP, such as a Tailscale MagicDNS name'
    )
    .action(
      withErrorHandling(async (options: { http?: number | true; allowHost?: string[] }) => {
        if (options.http === undefined) {
          await runMcpServer();
          return;
        }
        const server = await runMcpHttpServer(
          options.http === true ? DEFAULT_HTTP_PORT : options.http,
          options.allowHost
        );
        const { port } = server.address() as AddressInfo;
        console.error(`OmniFocus MCP server listening on http://127.0.0.1:${port}/mcp`);
      })
    );
}
