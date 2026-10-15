import { Hono } from 'hono';
import type { TokenScope } from '../apiTokens.js';
import { pool } from '../db.js';
import { handleMcp, isOriginAllowed } from './index.js';

type Variables = { userId: string; userRole: string; apiTokenScope: TokenScope };

export function createMcpRouter(allowedOrigins: readonly string[]) {
  const router = new Hono<{ Variables: Variables }>();

  // Streamable HTTP has a single endpoint. GET (server push) and DELETE (session
  // end) do not exist in the stateless protocol, so they fall through to handleMcp's 405.
  router.all('/', async (c) => {
    // DNS-rebinding guard required by the spec: a browser page from another
    // origin must not be able to drive this endpoint.
    if (!isOriginAllowed(c.req.header('Origin'), allowedOrigins)) {
      return c.json({ success: false, message: 'Origin が許可されていません' }, 403);
    }

    const headers: Record<string, string | undefined> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const result = await handleMcp({
      method: c.req.method,
      headers,
      bodyText: c.req.method === 'POST' ? await c.req.text() : '',
      tokenScope: c.get('apiTokenScope'),
      userId: c.get('userId'),
      db: pool,
    });

    for (const [k, v] of Object.entries(result.headers ?? {})) c.header(k, v);
    if (result.body === undefined) return c.body(null, result.status as 202 | 405);
    return c.json(result.body as object, result.status as 200 | 400 | 404);
  });

  return router;
}
