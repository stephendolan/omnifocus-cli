import type { AddressInfo } from 'node:net';
import { Command, InvalidArgumentError, Option } from 'commander';
import { withErrorHandling } from '../lib/command-utils.js';
import { runMcpHttpServer } from '../mcp/http.js';
import { runMcpServer } from '../mcp/server.js';
import type { CapabilityMode } from '../mcp/capabilities.js';

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
    .addOption(
      new Option('--mode <mode>', 'Tool capability mode')
        .choices(['full', 'read-only'])
        .default('full')
    )
    .addOption(
      new Option(
        '--access-team-domain <url>',
        'Require Cloudflare Access JWTs issued by this team'
      ).env('CF_ACCESS_TEAM_DOMAIN')
    )
    .addOption(
      new Option(
        '--access-audience <audience>',
        'Required Cloudflare Access application audience'
      ).env('CF_ACCESS_AUDIENCE')
    )
    .action(
      withErrorHandling(
        async (options: {
          http?: number | true;
          allowHost?: string[];
          mode: CapabilityMode;
          accessTeamDomain?: string;
          accessAudience?: string;
        }) => {
          const accessRequested =
            options.accessTeamDomain !== undefined || options.accessAudience !== undefined;
          if (
            accessRequested &&
            (!options.accessTeamDomain || !options.accessAudience || options.http === undefined)
          ) {
            throw new Error(
              'Cloudflare Access requires --http, --access-team-domain and --access-audience together'
            );
          }
          if (options.http === undefined) {
            await runMcpServer({ mode: options.mode });
            return;
          }
          const server = await runMcpHttpServer(
            options.http === true ? DEFAULT_HTTP_PORT : options.http,
            options.allowHost,
            {
              mode: options.mode,
              access: accessRequested
                ? {
                    teamDomain: options.accessTeamDomain!,
                    audience: options.accessAudience!,
                  }
                : undefined,
            }
          );
          const { port } = server.address() as AddressInfo;
          console.error(`OmniFocus MCP server listening on http://127.0.0.1:${port}/mcp`);
        }
      )
    );
}
