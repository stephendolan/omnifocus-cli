import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createAccessVerifier, type AccessConfig } from './access.js';
import { createMcpServer, type McpServerOptions } from './server.js';

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1'];
const MAX_IN_FLIGHT_REQUESTS = 16;
const HOST_AUTHORITY = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i;

function normalizeHostname(name: string): string {
  return name.toLowerCase().replace(/\.$/, '');
}

function hostnameOf(hostHeader: string | undefined): string | null {
  const match = hostHeader ? HOST_AUTHORITY.exec(hostHeader) : null;
  return match ? normalizeHostname(match[1]) : null;
}

function sendError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: McpServerOptions
): Promise<void> {
  const server = createMcpServer(options);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}

// Listens on loopback only. The Host allowlist blocks DNS rebinding from local browsers;
// add the names a reverse proxy such as `tailscale serve` forwards with `allowedHostnames`.
export interface McpHttpOptions extends Omit<McpServerOptions, 'execute'> {
  access?: AccessConfig;
}

export function runMcpHttpServer(
  port: number,
  allowedHostnames: string[] = [],
  options: McpHttpOptions = {}
): Promise<Server> {
  const verifyAccess = options.access ? createAccessVerifier(options.access) : undefined;
  const hostnames = new Set([...LOOPBACK_HOSTNAMES, ...allowedHostnames].map(normalizeHostname));
  let inFlight = 0;
  let executing = 0;

  async function execute<T>(operation: () => Promise<T>): Promise<T> {
    if (executing >= MAX_IN_FLIGHT_REQUESTS) {
      throw new Error('Too many concurrent OmniFocus operations');
    }
    executing++;
    try {
      return await operation();
    } finally {
      executing--;
    }
  }

  const httpServer = createServer((req, res) => {
    const hostname = hostnameOf(req.headers.host);
    if (!hostname || !hostnames.has(hostname)) {
      sendError(res, 403, `Host not allowed: ${req.headers.host ?? '(missing)'}`);
      return;
    }
    if (req.url?.split('?', 1)[0] !== '/mcp') {
      sendError(res, 404, 'Not found');
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'POST' }).end();
      return;
    }
    if (inFlight >= MAX_IN_FLIGHT_REQUESTS) {
      res.setHeader('Retry-After', '1');
      sendError(res, 503, 'Too many concurrent requests');
      return;
    }

    inFlight++;
    res.on('close', () => {
      inFlight--;
    });
    async function dispatch() {
      if (verifyAccess) {
        try {
          await verifyAccess(req.headers['cf-access-jwt-assertion']);
        } catch {
          sendError(res, 401, 'Invalid or missing Cloudflare Access assertion');
          return;
        }
      }
      if (!res.destroyed) await handleMcpRequest(req, res, { ...options, execute });
    }
    dispatch().catch((error: unknown) => {
      if (!res.headersSent) {
        sendError(res, 500, error instanceof Error ? error.message : String(error));
      }
    });
  });

  return new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', () => resolve(httpServer));
  });
}
