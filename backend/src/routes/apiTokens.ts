import { Hono } from 'hono';
import { pool } from '../db.js';
import { generateApiToken, isTokenScope, type TokenScope } from '../apiTokens.js';

type Variables = { userId: string; userRole: string };
const router = new Hono<{ Variables: Variables }>();

const MAX_TOKENS_PER_USER = 10;

const DEFAULT_LABELS: Record<TokenScope, string> = {
  obsidian_export: 'Obsidian連携',
  mcp_read: 'MCP(読み取り)',
  mcp_write: 'MCP(読み書き)',
};

// List tokens (metadata only — the plaintext is never stored, so it can never
// be shown again after issuance).
router.get('/', async (c) => {
  const userId = c.get('userId');
  const [rows] = await pool.query<any[]>(
    `SELECT id, name, scope, last_used_at, created_at
     FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return c.json(rows);
});

router.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req
    .json<{ name?: string; scope?: string }>()
    .catch(() => ({ name: undefined, scope: undefined }));
  // Omitting `scope` keeps the pre-MCP behaviour (Obsidian export token).
  const scope = body.scope ?? 'obsidian_export';
  if (!isTokenScope(scope)) {
    return c.json({ success: false, message: 'scope が不正です' }, 400);
  }

  const [countRows] = await pool.query<any[]>(
    'SELECT COUNT(*) AS cnt FROM api_tokens WHERE user_id = ?',
    [userId]
  );
  if (countRows[0].cnt >= MAX_TOKENS_PER_USER) {
    return c.json({ success: false, message: `トークンは最大${MAX_TOKENS_PER_USER}件まで発行できます` }, 400);
  }

  const { plaintext, hash } = generateApiToken();
  const id = crypto.randomUUID();
  const label = (body.name ?? '').trim().slice(0, 100) || DEFAULT_LABELS[scope];
  await pool.query(
    'INSERT INTO api_tokens (id, user_id, name, token_hash, scope) VALUES (?, ?, ?, ?, ?)',
    [id, userId, label, hash, scope]
  );

  // Plaintext is returned exactly once. The caller must save it now.
  return c.json({ success: true, id, name: label, scope, token: plaintext });
});

router.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const [del] = await pool.query<any>('DELETE FROM api_tokens WHERE id = ? AND user_id = ?', [id, userId]);
  if (del.affectedRows === 0) {
    return c.json({ success: false, message: 'トークンが見つかりません' }, 404);
  }
  return c.json({ success: true });
});

export default router;
