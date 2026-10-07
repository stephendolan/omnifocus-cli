import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { runMcpHttpServer } from '../http.js';

const MCP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

const rpc = (id: number, method: string, params: object = {}) => ({
  jsonrpc: '2.0',
  id,
  method,
  params,
});

function send(
  port: number,
  method: string,
  path: string,
  body?: unknown,
  host = `127.0.0.1:${port}`
) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, method, path, headers: { ...MCP_HEADERS, Host: host } },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

// Sends headers for a body that never arrives, holding the request open.
function stall(port: number) {
  const req = request({
    host: '127.0.0.1',
    port,
    method: 'POST',
    path: '/mcp',
    headers: { ...MCP_HEADERS, Host: `127.0.0.1:${port}`, 'Content-Length': '100' },
  });
  req.on('error', () => {});
  req.flushHeaders();
  return req;
}

describe('runMcpHttpServer', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = await runMcpHttpServer(0, ['Mac.Example.ts.net.']);
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it('lists tools over Streamable HTTP', async () => {
    const res = await send(port, 'POST', '/mcp', rpc(1, 'tools/list'));
    expect(res.status).toBe(200);
    const names = JSON.parse(res.body).result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toContain('list_tasks');
  });

  it('calls tools', async () => {
    const res = await send(
      port,
      'POST',
      '/mcp',
      rpc(2, 'tools/call', { name: 'search_tools', arguments: { query: 'inbox' } })
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).result.content[0].text).toContain('list_inbox');
  });

  it('accepts allowed hostnames on any port, normalized', async () => {
    for (const host of ['mac.example.ts.net:8443', 'MAC.EXAMPLE.TS.NET.:8443', 'LOCALHOST.']) {
      expect((await send(port, 'POST', '/mcp', rpc(3, 'tools/list'), host)).status).toBe(200);
    }
  });

  it('rejects other Host values', async () => {
    for (const host of ['attacker.example', 'evil@localhost', 'localhost/evil']) {
      expect((await send(port, 'POST', '/mcp', rpc(4, 'tools/list'), host)).status).toBe(403);
    }
  });

  it('serves only POST /mcp', async () => {
    expect((await send(port, 'GET', '/mcp')).status).toBe(405);
    expect((await send(port, 'POST', '/other', rpc(5, 'tools/list'))).status).toBe(404);
  });

  it('keeps serving after a malformed request target', async () => {
    expect((await send(port, 'POST', '//[', rpc(6, 'tools/list'))).status).toBe(404);
    expect((await send(port, 'POST', '/mcp', rpc(7, 'tools/list'))).status).toBe(200);
  });
});

// Bun's HTTP server never reports a client that disconnects mid-request, so the
// in-flight cap runs against the built CLI under Node, the runtime it ships with.
describe('of mcp --http under Node', () => {
  const distCli = join(process.cwd(), 'dist', 'cli.js');

  it('caps in-flight requests and frees capacity when clients disconnect', async () => {
    if (!existsSync(distCli)) {
      throw new Error('dist/cli.js not found — run `bun run build` before this test suite.');
    }
    const child = spawn(distCli, ['mcp', '--http', '0'], { stdio: ['ignore', 'ignore', 'pipe'] });
    try {
      const port = await new Promise<number>((resolve, reject) => {
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk: string) => {
          const match = /127\.0\.0\.1:(\d+)/.exec(chunk);
          if (match) resolve(Number(match[1]));
        });
        child.on('exit', (code) => reject(new Error(`server exited with code ${code}`)));
      });

      const stalled = Array.from({ length: 16 }, () => stall(port));
      await Bun.sleep(200);
      expect((await send(port, 'POST', '/mcp', rpc(8, 'tools/list'))).status).toBe(503);

      for (const req of stalled) req.destroy();
      let status = 0;
      for (let attempt = 0; attempt < 20 && status !== 200; attempt++) {
        await Bun.sleep(50);
        status = (await send(port, 'POST', '/mcp', rpc(9, 'tools/list'))).status;
      }
      expect(status).toBe(200);
    } finally {
      child.kill();
    }
  });
});
