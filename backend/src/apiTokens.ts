import crypto from 'node:crypto';
import type { Context, Next } from 'hono';
import { pool } from './db.js';

const TOKEN_PREFIX = 'tasqa_';

// Generates a plaintext token (shown once) and its SHA-256 hash (stored).
// Plaintext format: tasqa_<43 base64url chars> — visually distinguishable from
// the JWT session tokens, and greppable if it ever leaks into a log.
export function generateApiToken(): { plaintext: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url');
  const plaintext = `${TOKEN_PREFIX}${raw}`;
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

export function hashApiToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

type Variables = { userId: string; userRole: string; apiTokenId: string };

// Auth for machine-to-machine endpoints (Obsidian export). Accepts a long-lived
// personal API token via `Authorization: Bearer tasqa_...`, distinct from the
// short-lived JWT used by the SPA. Suspended users are rejected, same as JWT auth.
export async function apiTokenMiddleware(c: Context<{ Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    return c.json({ success: false, message: 'APIトークンが必要です' }, 401);
  }

  const hash = hashApiToken(token);
  const [rows] = await pool.query<any[]>(
    `SELECT t.id AS token_id, u.id AS user_id, u.role, u.is_suspended
     FROM api_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ?`,
    [hash]
  );
  const row = rows[0];
  if (!row) {
    return c.json({ success: false, message: 'APIトークンが無効です' }, 401);
  }
  if (row.is_suspended) {
    return c.json({ success: false, message: 'このアカウントは停止されています' }, 403);
  }

  await pool.query('UPDATE api_tokens SET last_used_at = UTC_TIMESTAMP() WHERE id = ?', [row.token_id]);

  c.set('userId', row.user_id);
  c.set('userRole', row.role ?? 'user');
  c.set('apiTokenId', row.token_id);
  await next();
}
