import { Hono } from 'hono';
import { pool } from '../db.js';

type Variables = { userId: string; userRole: string };
const router = new Hono<{ Variables: Variables }>();

router.get('/users', async (c) => {
  const [rows] = await pool.query<any[]>(
    `SELECT id, email, role, is_suspended, email_verified, created_at,
       (SELECT COUNT(*) FROM tasks WHERE tasks.user_id = users.id) AS task_count,
       (SELECT COUNT(*) FROM events WHERE events.user_id = users.id) AS event_count
     FROM users ORDER BY created_at ASC`
  );
  return c.json(rows);
});

router.get('/users/:id/tasks', async (c) => {
  const targetId = c.req.param('id');
  const [rows] = await pool.query(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY deadline ASC',
    [targetId]
  );
  return c.json(rows);
});

router.get('/users/:id/events', async (c) => {
  const targetId = c.req.param('id');
  const [rows] = await pool.query(
    'SELECT * FROM events WHERE user_id = ? ORDER BY start_dt ASC',
    [targetId]
  );
  return c.json(rows);
});

router.put('/users/:id/suspend', async (c) => {
  const targetId = c.req.param('id');
  const adminId = c.get('userId');
  if (targetId === adminId) {
    return c.json({ success: false, message: '自分自身を停止することはできません' }, 400);
  }
  const [rows] = await pool.query<any[]>('SELECT role FROM users WHERE id = ?', [targetId]);
  if (rows[0]?.role === 'admin') {
    return c.json({ success: false, message: '管理者アカウントは停止できません' }, 400);
  }
  await pool.query('UPDATE users SET is_suspended = TRUE WHERE id = ?', [targetId]);
  return c.json({ success: true });
});

router.put('/users/:id/unsuspend', async (c) => {
  const targetId = c.req.param('id');
  await pool.query('UPDATE users SET is_suspended = FALSE WHERE id = ?', [targetId]);
  return c.json({ success: true });
});

router.delete('/users/:id', async (c) => {
  const targetId = c.req.param('id');
  const adminId = c.get('userId');
  if (targetId === adminId) {
    return c.json({ success: false, message: '自分自身を削除することはできません' }, 400);
  }
  const [rows] = await pool.query<any[]>('SELECT role FROM users WHERE id = ?', [targetId]);
  if (rows[0]?.role === 'admin') {
    return c.json({ success: false, message: '管理者アカウントは削除できません' }, 400);
  }
  await pool.query('DELETE FROM tasks WHERE user_id = ?', [targetId]);
  await pool.query('DELETE FROM events WHERE user_id = ?', [targetId]);
  await pool.query('DELETE FROM push_subscriptions WHERE user_id = ?', [targetId]);
  await pool.query('DELETE FROM users WHERE id = ?', [targetId]);
  return c.json({ success: true });
});

export default router;
