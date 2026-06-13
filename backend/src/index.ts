import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import bcrypt from 'bcryptjs';
import { pool, initDB } from './db.js';
import { authMiddleware, createSessionToken } from './auth.js';
import { nextDeadline, type RepeatType } from './repeat.js';

const app = new Hono();

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(
  '*',
  cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

function toMysqlDatetime(value: string | Date) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

// --- Public routes ---------------------------------------------------------

app.get('/api/health', (c) => c.json({ ok: true }));

app.post('/api/login', async (c) => {
  const { password } = await c.req.json<{ password?: string }>();
  if (!password) {
    return c.json({ success: false, message: 'パスワードを入力してください' }, 400);
  }

  const [rows] = await pool.query<any[]>('SELECT password_hash FROM users LIMIT 1');
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return c.json({ success: false, message: 'パスワードが違います' }, 401);
  }

  const token = await createSessionToken();
  return c.json({ success: true, token });
});

// --- Protected routes --------------------------------------------------------

app.use('/api/settings/*', authMiddleware);
app.use('/api/tasks', authMiddleware);
app.use('/api/tasks/*', authMiddleware);

app.put('/api/settings/password', async (c) => {
  const { newPassword } = await c.req.json<{ newPassword?: string }>();
  if (!newPassword || newPassword.length < 4) {
    return c.json({ success: false, message: 'パスワードは4文字以上にしてください' }, 400);
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = ?', [hash]);
  return c.json({ success: true });
});

app.get('/api/tasks', async (c) => {
  const [rows] = await pool.query(
    'SELECT * FROM tasks WHERE is_completed = FALSE ORDER BY sort_order ASC, deadline ASC'
  );
  return c.json(rows);
});

app.post('/api/tasks', async (c) => {
  const { id, title, deadline, repeat_type, sort_order } = await c.req.json<{
    id: string;
    title: string;
    deadline: string;
    repeat_type: RepeatType;
    sort_order?: number;
  }>();

  if (!id || !title?.trim() || !deadline) {
    return c.json({ success: false, message: 'タスク名と締め切りは必須です' }, 400);
  }

  await pool.query(
    'INSERT INTO tasks (id, title, deadline, repeat_type, sort_order) VALUES (?, ?, ?, ?, ?)',
    [id, title.trim(), toMysqlDatetime(deadline), repeat_type ?? 'none', sort_order ?? 0]
  );
  return c.json({ success: true });
});

app.put('/api/tasks/reorder', async (c) => {
  const { orders } = await c.req.json<{ orders: { id: string; sort_order: number }[] }>();
  for (const item of orders) {
    await pool.query('UPDATE tasks SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
  }
  return c.json({ success: true });
});

app.put('/api/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const { title, deadline, repeat_type, is_completed } = await c.req.json<{
    title: string;
    deadline: string;
    repeat_type: RepeatType;
    is_completed: boolean;
  }>();

  if (!title?.trim() || !deadline) {
    return c.json({ success: false, message: 'タスク名と締め切りは必須です' }, 400);
  }

  await pool.query(
    'UPDATE tasks SET title = ?, deadline = ?, repeat_type = ?, is_completed = ? WHERE id = ?',
    [title.trim(), toMysqlDatetime(deadline), repeat_type ?? 'none', is_completed ? 1 : 0, id]
  );

  // When a repeating task is marked complete, schedule its next occurrence.
  if (is_completed && repeat_type && repeat_type !== 'none') {
    const next = nextDeadline(new Date(deadline), repeat_type);
    if (next) {
      await pool.query(
        'INSERT INTO tasks (id, title, deadline, repeat_type, sort_order) VALUES (?, ?, ?, ?, 0)',
        [crypto.randomUUID(), title.trim(), toMysqlDatetime(next), repeat_type]
      );
    }
  }

  return c.json({ success: true });
});

app.delete('/api/tasks/:id', async (c) => {
  const id = c.req.param('id');
  await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
  return c.json({ success: true });
});

const port = Number(process.env.PORT ?? 3000);

initDB()
  .then(async () => {
    const [rows] = await pool.query<any[]>('SELECT * FROM users LIMIT 1');
    if (rows.length === 0) {
      const hash = await bcrypt.hash('yukitask', 10);
      await pool.query('INSERT INTO users (password_hash) VALUES (?)', [hash]);
    }
    console.log('DB initialized successfully');
  })
  .catch((err) => {
    console.error('MySQLへの接続に失敗しました:', err);
  });

serve({ fetch: app.fetch, port });
console.log(`Server is running on port ${port}`);
