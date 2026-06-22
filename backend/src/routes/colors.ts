import { Hono } from 'hono';
import { pool } from '../db.js';

type Variables = { userId: string; userRole: string };
const app = new Hono<{ Variables: Variables }>();

const MAX_USER_COLORS = 20;

app.get('/', async (c) => {
  const userId = c.get('userId');
  const [rows] = await pool.query<any[]>(
    'SELECT id, hex, name FROM user_colors WHERE user_id = ? ORDER BY created_at ASC',
    [userId]
  );
  return c.json(rows);
});

app.post('/', async (c) => {
  const userId = c.get('userId');
  const { hex, name } = await c.req.json<{ hex: string; name?: string }>();

  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return c.json({ success: false, message: '無効なカラーコードです' }, 400);
  }

  const [countRows] = await pool.query<any[]>(
    'SELECT COUNT(*) AS cnt FROM user_colors WHERE user_id = ?',
    [userId]
  );
  if (countRows[0].cnt >= MAX_USER_COLORS) {
    return c.json({ success: false, message: `カラーは最大${MAX_USER_COLORS}件まで登録できます` }, 400);
  }

  const id = crypto.randomUUID();
  await pool.query(
    'INSERT INTO user_colors (id, user_id, hex, name) VALUES (?, ?, ?, ?)',
    [id, userId, hex, (name ?? '').slice(0, 50)]
  );
  return c.json({ success: true, id, hex, name: name ?? '' });
});

app.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const colorId = c.req.param('id');
  await pool.query('DELETE FROM user_colors WHERE id = ? AND user_id = ?', [colorId, userId]);
  return c.json({ success: true });
});

export default app;
