import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Hono } from 'hono';
import { apiTokenAuth, generateApiToken, isTokenScope } from './apiTokens.js';
import { pool } from './db.js';

// The pool connects lazily, so replacing `query` is enough to run the middleware without MySQL.
const realQuery = pool.query.bind(pool);
afterEach(() => {
  (pool as any).query = realQuery;
});

function stubTokens(tokens: Record<string, { scope: string; suspended?: boolean }>) {
  const updates: unknown[][] = [];
  (pool as any).query = async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM api_tokens')) {
      const t = tokens[params[0] as string];
      return [t ? [{ token_id: 'tok-1', scope: t.scope, user_id: 'user-1', role: 'user', is_suspended: !!t.suspended }] : []];
    }
    if (sql.startsWith('UPDATE api_tokens')) updates.push(params);
    return [[]];
  };
  return updates;
}

function appFor(scopes: Parameters<typeof apiTokenAuth>[0]) {
  const app = new Hono();
  app.use('*', apiTokenAuth(scopes));
  app.get('/', (c) => c.text('ok'));
  return app;
}

const call = (app: Hono, token?: string) =>
  app.request('/', { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('a token only works on endpoints that list its scope', async () => {
  const obsidian = generateApiToken();
  const mcpRead = generateApiToken();
  const mcpWrite = generateApiToken();
  stubTokens({
    [obsidian.hash]: { scope: 'obsidian_export' },
    [mcpRead.hash]: { scope: 'mcp_read' },
    [mcpWrite.hash]: { scope: 'mcp_write' },
  });

  const obsidianEndpoint = appFor(['obsidian_export']);
  const mcpEndpoint = appFor(['mcp_read', 'mcp_write']);

  assert.equal((await call(obsidianEndpoint, obsidian.plaintext)).status, 200);
  assert.equal((await call(obsidianEndpoint, mcpRead.plaintext)).status, 401);
  assert.equal((await call(obsidianEndpoint, mcpWrite.plaintext)).status, 401);

  assert.equal((await call(mcpEndpoint, mcpRead.plaintext)).status, 200);
  assert.equal((await call(mcpEndpoint, mcpWrite.plaintext)).status, 200);
  assert.equal((await call(mcpEndpoint, obsidian.plaintext)).status, 401);
});

test('missing, malformed, unknown and suspended are rejected; last_used_at only updates on success', async () => {
  const good = generateApiToken();
  const suspended = generateApiToken();
  const wrongScope = generateApiToken();
  const updates = stubTokens({
    [good.hash]: { scope: 'mcp_read' },
    [suspended.hash]: { scope: 'mcp_read', suspended: true },
    [wrongScope.hash]: { scope: 'obsidian_export' },
  });
  const app = appFor(['mcp_read']);

  assert.equal((await call(app)).status, 401);
  assert.equal((await call(app, 'not-a-tasqa-token')).status, 401);
  assert.equal((await call(app, generateApiToken().plaintext)).status, 401);
  assert.equal((await call(app, suspended.plaintext)).status, 403);
  assert.equal((await call(app, wrongScope.plaintext)).status, 401);
  assert.equal(updates.length, 0);

  assert.equal((await call(app, good.plaintext)).status, 200);
  assert.equal(updates.length, 1);
});

test('a scope outside the allowlist in the DB never authenticates', async () => {
  const t = generateApiToken();
  stubTokens({ [t.hash]: { scope: 'something_else' } });
  assert.equal((await call(appFor(['mcp_read', 'mcp_write', 'obsidian_export']), t.plaintext)).status, 401);
});

test('isTokenScope', () => {
  assert.equal(isTokenScope('mcp_write'), true);
  assert.equal(isTokenScope('admin'), false);
  assert.equal(isTokenScope(undefined), false);
});
