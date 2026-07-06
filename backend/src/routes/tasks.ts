import { Hono } from 'hono';
import { pool } from '../db.js';
import { parseDeadline, toMysqlDatetime } from '../helpers.js';
import { nextDeadline, type RepeatType } from '../repeat.js';

type Variables = { userId: string; userRole: string };
const router = new Hono<{ Variables: Variables }>();

router.get('/', async (c) => {
  const userId = c.get('userId');
  const [rows] = await pool.query(
    'SELECT * FROM tasks WHERE user_id = ? AND is_completed = FALSE ORDER BY sort_order ASC, deadline ASC',
    [userId]
  );
  return c.json(rows);
});

router.post('/', async (c) => {
  const userId = c.get('userId');
  const { id, title, deadline, repeat_type, sort_order, color } = await c.req.json<{
    id: string; title: string; deadline: string;
    repeat_type: RepeatType; sort_order?: number; color?: string;
  }>();
  if (!id || !title?.trim() || !deadline) {
    return c.json({ success: false, message: 'タスク名と締め切りは必須です' }, 400);
  }
  await pool.query(
    'INSERT INTO tasks (id, user_id, title, deadline, repeat_type, sort_order, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, userId, title.trim(), toMysqlDatetime(deadline), repeat_type ?? 'none', sort_order ?? 0, color ?? null]
  );
  return c.json({ success: true });
});

router.put('/reorder', async (c) => {
  const userId = c.get('userId');
  const { orders } = await c.req.json<{ orders: { id: string; sort_order: number }[] }>();
  for (const item of orders) {
    await pool.query('UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?', [item.sort_order, item.id, userId]);
  }
  return c.json({ success: true });
});

router.put('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { title, deadline, repeat_type, is_completed, color } = await c.req.json<{
    title: string; deadline: string; repeat_type: RepeatType; is_completed: boolean; color?: string;
  }>();
  if (!title?.trim() || !deadline) {
    return c.json({ success: false, message: 'タスク名と締め切りは必須です' }, 400);
  }

  if (is_completed) {
    // I2: only act if the task actually belongs to the caller.
    const [del] = await pool.query<any>('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
    if (del.affectedRows === 0) {
      return c.json({ success: false, message: 'タスクが見つかりません' }, 404);
    }
    if (repeat_type && repeat_type !== 'none') {
      const next = nextDeadline(parseDeadline(deadline), repeat_type);
      if (next) {
        await pool.query(
          'INSERT INTO tasks (id, user_id, title, deadline, repeat_type, sort_order) VALUES (?, ?, ?, ?, ?, 0)',
          [crypto.randomUUID(), userId, title.trim(), toMysqlDatetime(next), repeat_type]
        );
      }
    }
    return c.json({ success: true });
  }

  const [upd] = await pool.query<any>(
    'UPDATE tasks SET title = ?, deadline = ?, repeat_type = ?, is_completed = FALSE, color = ?, reminder_sent_at = NULL WHERE id = ? AND user_id = ?',
    [title.trim(), toMysqlDatetime(deadline), repeat_type ?? 'none', color ?? null, id, userId]
  );
  if (upd.affectedRows === 0) {
    return c.json({ success: false, message: 'タスクが見つかりません' }, 404);
  }
  return c.json({ success: true });
});

router.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const [del] = await pool.query<any>('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  if (del.affectedRows === 0) {
    return c.json({ success: false, message: 'タスクが見つかりません' }, 404);
  }
  return c.json({ success: true });
});

export default router;
