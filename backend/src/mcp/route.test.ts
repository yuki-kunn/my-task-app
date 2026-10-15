import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Hono } from 'hono';
import { apiTokenAuth, generateApiToken } from '../apiTokens.js';
import { pool } from '../db.js';
import { createMcpRouter } from './route.js';

const realQuery = pool.query.bind(pool);
afterEach(() => {
  (pool as any).query = realQuery;
});

const token = generateApiToken();

function buildApp() {
  (pool as any).query = async (sql: string) => {
    if (sql.includes('FROM api_tokens')) {
      return [[{ token_id: 't', scope: 'mcp_read', user_id: 'user-1', role: 'user', is_suspended: false }]];
    }
    return [[]]; // every other query: no rows
  };
  const app = new Hono();
  app.use('/mcp', apiTokenAuth(['mcp_read', 'mcp_write']));
  app.use('/mcp/*', apiTokenAuth(['mcp_read', 'mcp_write']));
  app.route('/mcp', createMcpRouter(['https://app.example.com']));
  return app;
}

const auth = { Authorization: `Bearer ${token.plaintext}` };
const modern = (method: string, extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  'MCP-Protocol-Version': '2026-07-28',
  'Mcp-Method': method,
  ...auth,
  ...extra,
});
const body = (id: number, method: string, params: object = {}) =>
  JSON.stringify({ jsonrpc: '2.0', id, method, params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } });

test('unauthenticated requests never reach the handler (with or without trailing slash)', async () => {
  const app = buildApp();
  for (const path of ['/mcp', '/mcp/']) {
    const res = await app.request(path, { method: 'POST', body: body(1, 'ping'), headers: { 'Content-Type': 'application/json' } });
    assert.equal(res.status, 401, path);
  }
});

test('POST tools/list over HTTP', async () => {
  const res = await buildApp().request('/mcp', { method: 'POST', headers: modern('tools/list'), body: body(1, 'tools/list') });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  const json = (await res.json()) as any;
  assert.deepEqual(json.result.tools.map((t: any) => t.name), ['list_agenda', 'get_item']);
});

test('tools/call end to end through auth, router and tool', async () => {
  const res = await buildApp().request('/mcp', {
    method: 'POST',
    headers: modern('tools/call', { 'Mcp-Name': 'list_agenda' }),
    body: body(2, 'tools/call', { name: 'list_agenda' }),
  });
  assert.equal(res.status, 200);
  const json = (await res.json()) as any;
  assert.equal(json.result.structuredContent.items.length, 0);
});

test('notification gets an empty 202; GET/DELETE get 405', async () => {
  const app = buildApp();
  const note = await app.request('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: '{"jsonrpc":"2.0","method":"notifications/initialized"}',
  });
  assert.equal(note.status, 202);
  assert.equal(await note.text(), '');

  for (const method of ['GET', 'DELETE']) {
    const res = await app.request('/mcp', { method, headers: auth });
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get('allow'), 'POST');
  }
});

test('a foreign Origin is refused with 403, an allowed one passes', async () => {
  const app = buildApp();
  const evil = await app.request('/mcp', {
    method: 'POST', headers: modern('ping', { Origin: 'https://evil.example.com' }), body: body(1, 'ping'),
  });
  assert.equal(evil.status, 403);
  const ok = await app.request('/mcp', {
    method: 'POST', headers: modern('ping', { Origin: 'https://app.example.com' }), body: body(1, 'ping'),
  });
  assert.equal(ok.status, 200);
});
