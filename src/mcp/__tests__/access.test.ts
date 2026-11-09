import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runMcpHttpServer } from '../http.js';

const issuer = 'https://dolanfamily.cloudflareaccess.com';
const audience = 'test-application-audience';
const keys = await generateKeyPair('RS256');
const forgedKeys = await generateKeyPair('RS256');
async function token(overrides: Record<string, unknown> = {}, forged = false) {
  return new SignJWT({
    iss: issuer,
    aud: [audience],
    sub: 'test-principal',
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .sign(forged ? forgedKeys.privateKey : keys.privateKey);
}

function call(port: number, host: string, assertion?: string) {
  return new Promise<{
    status: number;
    body: { result: { tools: Array<{ name: string }> }; error: { message: string } };
  }>((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: '/mcp',
        method: 'POST',
        headers: {
          Host: host,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...(assertion ? { 'Cf-Access-Jwt-Assertion': assertion } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(body) }));
      }
    );
    req.on('error', reject);
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
  });
}

describe('Access authentication at the HTTP origin', () => {
  let server: Server;
  let port: number;
  const fetchMock = spyOn(globalThis, 'fetch');
  beforeAll(async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256' }],
      })
    );
    server = await runMcpHttpServer(0, ['omnifocus.stephendolan.com'], {
      access: { teamDomain: issuer, audience },
    });
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => {
    fetchMock.mockRestore();
    server.closeAllConnections();
    server.close();
  });

  it('accepts correctly signed assertions and fetches keys only from the configured issuer', async () => {
    const assertion = await token();
    for (const host of ['localhost', '127.0.0.1', 'omnifocus.stephendolan.com']) {
      const result = await call(port, host, assertion);
      expect(result.status).toBe(200);
      expect(result.body.result.tools.length).toBe(26);
    }
    expect(fetchMock.mock.calls[0][0].toString()).toBe(`${issuer}/cdn-cgi/access/certs`);
  });
  it('fails closed for missing, forged, expired, wrong-audience and wrong-issuer tokens on all allowed hosts', async () => {
    const assertions = [
      undefined,
      'forged.assertion.signature',
      await token({}, true),
      await token({ exp: 1 }),
      await token({ aud: ['other'] }),
      await token({ iss: 'https://attacker.example' }),
      await token({ exp: undefined }),
      await token({ nbf: Math.floor(Date.now() / 1000) + 3600 }),
    ];
    for (const host of ['localhost', '127.0.0.1', 'omnifocus.stephendolan.com']) {
      for (const assertion of assertions) {
        const result = await call(port, host, assertion);
        expect(result.status).toBe(401);
        expect(result.body.error.message).toBe('Invalid or missing Cloudflare Access assertion');
      }
    }
  });
  it('rejects HS256 even with matching claims', async () => {
    const jwt = await new SignJWT({
      iss: issuer,
      aud: [audience],
      exp: Math.floor(Date.now() / 1000) + 60,
    })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
      .sign(new TextEncoder().encode('a-test-key-that-is-not-a-secret'));
    expect((await call(port, 'localhost', jwt)).status).toBe(401);
  });
  it('fails closed when team keys cannot be fetched', async () => {
    fetchMock.mockRejectedValueOnce(new Error('JWKS unavailable'));
    const isolated = await runMcpHttpServer(0, [], { access: { teamDomain: issuer, audience } });
    try {
      const isolatedPort = (isolated.address() as AddressInfo).port;
      expect((await call(isolatedPort, 'localhost', await token())).status).toBe(401);
    } finally {
      isolated.closeAllConnections();
      isolated.close();
    }
  });
});
