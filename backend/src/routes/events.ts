import { Hono } from 'hono';
import { pool } from '../db.js';
import { parseDeadline, toMysqlDatetime, jstNowAsDatetime } from '../helpers.js';
import { nextEvent, type RepeatType } from '../repeat.js';

type Variables = { userId: string; userRole: string };
const router = new Hono<{ Variables: Variables }>();

router.get('/', async (c) => {
  const userId = c.get('userId');
  const now = jstNowAsDatetime();
  const [rows] = await pool.query(
    'SELECT * FROM events WHERE user_id = ? AND end_dt >= ? ORDER BY start_dt ASC',
    [userId, now]
  );
  return c.json(rows);
});

router.post('/', async (c) => {
  const userId = c.get('userId');
  const { id, title, start_dt, end_dt, memo, repeat_type, color } = await c.req.json<{
    id: string; title: string; start_dt: string; end_dt: string;
    memo?: string; repeat_type: RepeatType; color?: string;
  }>();
  if (!id || !title?.trim() || !start_dt || !end_dt) {
    return c.json({ success: false, message: 'タイトル・開始日時・終了日時は必須です' }, 400);
  }
  await pool.query(
    'INSERT INTO events (id, user_id, title, start_dt, end_dt, memo, repeat_type, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, userId, title.trim(), toMysqlDatetime(start_dt), toMysqlDatetime(end_dt), memo ?? null, repeat_type ?? 'none', color ?? null]
  );
  return c.json({ success: true });
});

router.put('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { title, start_dt, end_dt, memo, repeat_type, color } = await c.req.json<{
    title: string; start_dt: string; end_dt: string;
    memo?: string; repeat_type: RepeatType; color?: string;
  }>();
  if (!title?.trim() || !start_dt || !end_dt) {
    return c.json({ success: false, message: 'タイトル・開始日時・終了日時は必須です' }, 400);
  }
  await pool.query(
    'UPDATE events SET title = ?, start_dt = ?, end_dt = ?, memo = ?, repeat_type = ?, color = ?, reminder_sent_at = NULL WHERE id = ? AND user_id = ?',
    [title.trim(), toMysqlDatetime(start_dt), toMysqlDatetime(end_dt), memo ?? null, repeat_type ?? 'none', color ?? null, id, userId]
  );
  return c.json({ success: true });
});

router.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  await pool.query('DELETE FROM events WHERE id = ? AND user_id = ?', [id, userId]);
  return c.json({ success: true });
});

router.post('/:id/complete', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const [rows] = await pool.query<any[]>('SELECT * FROM events WHERE id = ? AND user_id = ?', [id, userId]);
  const event = rows[0];
  if (!event) return c.json({ success: false, message: 'Not found' }, 404);
  if (event.repeat_type && event.repeat_type !== 'none') {
    const next = nextEvent(parseDeadline(event.start_dt), parseDeadline(event.end_dt), event.repeat_type);
    if (next) {
      await pool.query(
        'INSERT INTO events (id, user_id, title, start_dt, end_dt, memo, repeat_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), userId, event.title, toMysqlDatetime(next.start), toMysqlDatetime(next.end), event.memo, event.repeat_type]
      );
    }
  }
  await pool.query('DELETE FROM events WHERE id = ? AND user_id = ?', [id, userId]);
  return c.json({ success: true });
});

export default router;
