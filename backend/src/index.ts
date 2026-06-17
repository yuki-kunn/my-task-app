import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import bcrypt from 'bcryptjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { pool, initDB } from './db.js';
import { authMiddleware, createSessionToken } from './auth.js';
import { nextDeadline, nextEvent, type RepeatType } from './repeat.js';
import { startScheduler } from './scheduler.js';
import { isPushConfigured } from './push.js';

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

// Task deadlines are wall-clock times with no timezone (the `datetime-local`
// input value, e.g. "2026-06-15T09:00"). We treat that literal value as UTC
// throughout - by appending "Z" when parsing - so the same digits are stored
// in MySQL and round-tripped back to the client without any timezone shift.
function parseDeadline(value: string | Date) {
  if (value instanceof Date) return value;
  if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  return new Date(value.length === 16 ? `${value}:00Z` : `${value}Z`);
}

function toMysqlDatetime(value: string | Date) {
  return parseDeadline(value).toISOString().slice(0, 19).replace('T', ' ');
}

function jstNowAsDatetime() {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
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
  const { id, title, deadline, repeat_type, sort_order, color } = await c.req.json<{
    id: string;
    title: string;
    deadline: string;
    repeat_type: RepeatType;
    sort_order?: number;
    color?: string;
  }>();

  if (!id || !title?.trim() || !deadline) {
    return c.json({ success: false, message: 'タスク名と締め切りは必須です' }, 400);
  }

  await pool.query(
    'INSERT INTO tasks (id, title, deadline, repeat_type, sort_order, color) VALUES (?, ?, ?, ?, ?, ?)',
    [id, title.trim(), toMysqlDatetime(deadline), repeat_type ?? 'none', sort_order ?? 0, color ?? null]
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
  const { title, deadline, repeat_type, is_completed, color } = await c.req.json<{
    title: string;
    deadline: string;
    repeat_type: RepeatType;
    is_completed: boolean;
    color?: string;
  }>();

  if (!title?.trim() || !deadline) {
    return c.json({ success: false, message: 'タスク名と締め切りは必須です' }, 400);
  }

  await pool.query(
    'UPDATE tasks SET title = ?, deadline = ?, repeat_type = ?, is_completed = ?, color = ?, reminder_sent_at = NULL WHERE id = ?',
    [title.trim(), toMysqlDatetime(deadline), repeat_type ?? 'none', is_completed ? 1 : 0, color ?? null, id]
  );

  // When a repeating task is marked complete, schedule its next occurrence.
  if (is_completed && repeat_type && repeat_type !== 'none') {
    const next = nextDeadline(parseDeadline(deadline), repeat_type);
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

// --- Events ------------------------------------------------------------------

app.use('/api/events', authMiddleware);
app.use('/api/events/*', authMiddleware);

app.get('/api/events', async (c) => {
  const now = jstNowAsDatetime();
  // Hide events whose end_dt has passed (auto-hide)
  const [rows] = await pool.query(
    'SELECT * FROM events WHERE end_dt >= ? ORDER BY start_dt ASC',
    [now]
  );
  return c.json(rows);
});

app.post('/api/events', async (c) => {
  const { id, title, start_dt, end_dt, memo, repeat_type, color } = await c.req.json<{
    id: string;
    title: string;
    start_dt: string;
    end_dt: string;
    memo?: string;
    repeat_type: RepeatType;
    color?: string;
  }>();

  if (!id || !title?.trim() || !start_dt || !end_dt) {
    return c.json({ success: false, message: 'タイトル・開始日時・終了日時は必須です' }, 400);
  }

  await pool.query(
    'INSERT INTO events (id, title, start_dt, end_dt, memo, repeat_type, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, title.trim(), toMysqlDatetime(start_dt), toMysqlDatetime(end_dt), memo ?? null, repeat_type ?? 'none', color ?? null]
  );
  return c.json({ success: true });
});

app.put('/api/events/:id', async (c) => {
  const id = c.req.param('id');
  const { title, start_dt, end_dt, memo, repeat_type, color } = await c.req.json<{
    title: string;
    start_dt: string;
    end_dt: string;
    memo?: string;
    repeat_type: RepeatType;
    color?: string;
  }>();

  if (!title?.trim() || !start_dt || !end_dt) {
    return c.json({ success: false, message: 'タイトル・開始日時・終了日時は必須です' }, 400);
  }

  await pool.query(
    'UPDATE events SET title = ?, start_dt = ?, end_dt = ?, memo = ?, repeat_type = ?, color = ?, reminder_sent_at = NULL WHERE id = ?',
    [title.trim(), toMysqlDatetime(start_dt), toMysqlDatetime(end_dt), memo ?? null, repeat_type ?? 'none', color ?? null, id]
  );

  return c.json({ success: true });
});

app.delete('/api/events/:id', async (c) => {
  const id = c.req.param('id');
  await pool.query('DELETE FROM events WHERE id = ?', [id]);
  return c.json({ success: true });
});

// Called when end_dt of a repeating event passes — generates the next occurrence.
app.post('/api/events/:id/complete', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const [rows] = await pool.query<any[]>('SELECT * FROM events WHERE id = ?', [id]);
  const event = rows[0];
  if (!event) return c.json({ success: false, message: 'Not found' }, 404);

  if (event.repeat_type && event.repeat_type !== 'none') {
    const next = nextEvent(parseDeadline(event.start_dt), parseDeadline(event.end_dt), event.repeat_type);
    if (next) {
      await pool.query(
        'INSERT INTO events (id, title, start_dt, end_dt, memo, repeat_type) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), event.title, toMysqlDatetime(next.start), toMysqlDatetime(next.end), event.memo, event.repeat_type]
      );
    }
  }
  await pool.query('DELETE FROM events WHERE id = ?', [id]);
  return c.json({ success: true });
});

// --- AI Parse ----------------------------------------------------------------

app.use('/api/ai/*', authMiddleware);

app.post('/api/ai/parse', async (c) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ success: false, message: 'GEMINI_API_KEY が設定されていません' }, 500);
  }

  const { text, mode } = await c.req.json<{ text: string; mode: 'simple' | 'organize' }>();
  if (!text?.trim()) {
    return c.json({ success: false, message: 'テキストを入力してください' }, 400);
  }

  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const nowJst = new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');

  const systemPrompt = mode === 'organize'
    ? `あなたはタスク・予定管理AIです。ユーザーの入力から複数のタスクまたは予定を抽出し、整理してJSON配列で返してください。
現在の日時（JST）: ${nowJst}
各アイテムは以下の形式で返すこと:
[
  {
    "type": "task" | "event",
    "title": "タイトル",
    "deadline": "YYYY-MM-DDTHH:MM" (type=taskの場合),
    "start_dt": "YYYY-MM-DDTHH:MM" (type=eventの場合),
    "end_dt": "YYYY-MM-DDTHH:MM" (type=eventの場合),
    "memo": "メモ（任意）",
    "repeat_type": "none" | "daily" | "weekly" | "yearly"
  }
]
日時が不明な場合は合理的に推測すること。必ずJSON配列のみ返すこと。`
    : `あなたはタスク・予定管理AIです。ユーザーの入力から1つのタスクまたは予定を抽出してJSON形式で返してください。
現在の日時（JST）: ${nowJst}
以下の形式で返すこと:
{
  "type": "task" | "event",
  "title": "タイトル",
  "deadline": "YYYY-MM-DDTHH:MM" (type=taskの場合),
  "start_dt": "YYYY-MM-DDTHH:MM" (type=eventの場合),
  "end_dt": "YYYY-MM-DDTHH:MM" (type=eventの場合),
  "memo": "メモ（任意）",
  "repeat_type": "none" | "daily" | "weekly" | "yearly"
}
必ずJSONオブジェクトのみ返すこと。`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(`${systemPrompt}\n\nユーザー入力: ${text}`);
    const raw = result.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return c.json({ success: true, items });
  } catch (err) {
    console.error('Gemini parse error:', err);
    return c.json({ success: false, message: 'AI解析に失敗しました' }, 500);
  }
});

// --- Push notifications ------------------------------------------------------

app.get('/api/push/vapid-public-key', (c) => {
  return c.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
});

app.post('/api/push/subscribe', authMiddleware, async (c) => {
  const { endpoint, keys } = await c.req.json<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>();

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json({ success: false, message: '購読情報が不正です' }, 400);
  }

  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE p256dh = ?, auth = ?`,
    [endpoint, keys.p256dh, keys.auth, keys.p256dh, keys.auth]
  );
  return c.json({ success: true });
});

app.post('/api/push/unsubscribe', authMiddleware, async (c) => {
  const { endpoint } = await c.req.json<{ endpoint: string }>();
  if (!endpoint) {
    return c.json({ success: false, message: 'endpointが必要です' }, 400);
  }
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
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

    if (isPushConfigured()) {
      startScheduler();
      console.log('Push notification scheduler started');
    } else {
      console.warn('VAPID keys are not set - push notifications are disabled');
    }
  })
  .catch((err) => {
    console.error('MySQLへの接続に失敗しました:', err);
  });

serve({ fetch: app.fetch, port });
console.log(`Server is running on port ${port}`);
