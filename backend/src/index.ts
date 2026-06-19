import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { pool, initDB } from './db.js';
import { authMiddleware, adminMiddleware, createSessionToken } from './auth.js';
import { nextDeadline, nextEvent, type RepeatType } from './repeat.js';
import { startScheduler } from './scheduler.js';
import { isPushConfigured } from './push.js';

type Variables = { userId: string; userRole: string };
const app = new Hono<{ Variables: Variables }>();

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// --- Helpers -----------------------------------------------------------------

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

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Simple email format check (RFC 5321 practical subset).
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim().toLowerCase());
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

// --- Public routes -----------------------------------------------------------

app.get('/api/health', (c) => c.json({ ok: true }));

// Step 1: send verification code to email (or return it in dev/fallback mode).
app.post('/api/auth/register', async (c) => {
  const { email } = await c.req.json<{ email?: string }>();
  if (!email || !isValidEmail(email)) {
    return c.json({ success: false, message: '有効なメールアドレスを入力してください' }, 400);
  }
  const normalized = email.trim().toLowerCase();

  // Check if already registered and verified.
  const [existing] = await pool.query<any[]>(
    'SELECT id, email_verified FROM users WHERE email = ?', [normalized]
  );
  if (existing.length > 0 && existing[0].email_verified) {
    return c.json({ success: false, message: 'このメールアドレスはすでに登録されています' }, 409);
  }

  // 期限切れコードを先に削除してからカウント（使用済み残骸による誤判定を防ぐ）。
  await pool.query(`DELETE FROM email_verifications WHERE expires_at <= NOW()`);

  // Rate-limit: max 5 active (未期限切れ) codes per email within 10 min.
  const [recent] = await pool.query<any[]>(
    `SELECT COUNT(*) AS cnt FROM email_verifications
     WHERE email = ? AND expires_at > NOW()`,
    [normalized]
  );
  if (recent[0].cnt >= 5) {
    return c.json({ success: false, message: 'しばらく待ってから再試行してください（10分後に再度お試しください）' }, 429);
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await pool.query(
    'INSERT INTO email_verifications (id, email, code, expires_at) VALUES (?, ?, ?, ?)',
    [crypto.randomUUID(), normalized, code, toMysqlDatetime(expiresAt)]
  );

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Tasqa <onboarding@resend.dev>',
      to: normalized,
      subject: 'Tasqa 認証コード',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#4f46e5">Tasqa 認証コード</h2>
          <p>以下の6桁のコードを入力してアカウントを作成してください。</p>
          <p style="font-size:2rem;font-weight:bold;letter-spacing:.5rem;color:#1e1e2e;margin:24px 0">${code}</p>
          <p style="color:#6b7280;font-size:.875rem">このコードは10分間有効です。心当たりがない場合は無視してください。</p>
        </div>
      `,
    });
    if (error) {
      console.error('Resend error:', error);
      return c.json({ success: false, message: 'メール送信に失敗しました。しばらく後に再試行してください' }, 500);
    }
    return c.json({ success: true, fallback: false });
  }

  return c.json({ success: true, fallback: true, code });
});

// Step 2: verify code and create account.
// Pass asAdmin=true to register the first admin (allowed only when no admin exists yet).
app.post('/api/auth/verify', async (c) => {
  const { email, code, asAdmin } = await c.req.json<{ email?: string; code?: string; asAdmin?: boolean }>();
  if (!email || !code) {
    return c.json({ success: false, message: 'メールアドレスとコードを入力してください' }, 400);
  }
  const normalized = email.trim().toLowerCase();

  // If requesting admin registration, ensure no admin exists yet.
  if (asAdmin) {
    const [adminRows] = await pool.query<any[]>(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminRows.length > 0) {
      return c.json({ success: false, message: '管理者アカウントはすでに存在します' }, 409);
    }
  }

  const [rows] = await pool.query<any[]>(
    `SELECT id FROM email_verifications
     WHERE email = ? AND code = ? AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalized, code.trim()]
  );
  if (rows.length === 0) {
    return c.json({ success: false, message: 'コードが無効または期限切れです' }, 400);
  }

  await pool.query('DELETE FROM email_verifications WHERE email = ?', [normalized]);

  const role = asAdmin ? 'admin' : 'user';
  const [existing] = await pool.query<any[]>('SELECT id FROM users WHERE email = ?', [normalized]);

  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
    await pool.query('UPDATE users SET email_verified = TRUE, role = ? WHERE id = ?', [role, userId]);
  } else {
    userId = crypto.randomUUID();
    const hash = await bcrypt.hash('pass', BCRYPT_ROUNDS);
    await pool.query(
      'INSERT INTO users (id, email, email_verified, password_hash, role) VALUES (?, ?, TRUE, ?, ?)',
      [userId, normalized, hash, role]
    );
  }

  const token = await createSessionToken(userId, role);
  return c.json({ success: true, token });
});

// Login with email + password.
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  if (!email || !password) {
    return c.json({ success: false, message: 'メールアドレスとパスワードを入力してください' }, 400);
  }
  const normalized = email.trim().toLowerCase();

  const [rows] = await pool.query<any[]>(
    'SELECT id, password_hash, email_verified, role, is_suspended, login_attempts, locked_until FROM users WHERE email = ?',
    [normalized]
  );
  const user = rows[0];

  if (!user || !user.email_verified) {
    return c.json({ success: false, message: 'メールアドレスまたはパスワードが違います' }, 401);
  }

  if (user.is_suspended) {
    return c.json({ success: false, message: 'このアカウントは停止されています。管理者にお問い合わせください' }, 403);
  }

  // Check lock.
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    return c.json({ success: false, message: `アカウントがロックされています。${remaining}分後に再試行してください` }, 429);
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const attempts = user.login_attempts + 1;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      await pool.query(
        'UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?',
        [attempts, toMysqlDatetime(lockedUntil), user.id]
      );
      return c.json({ success: false, message: `ログイン失敗が${MAX_LOGIN_ATTEMPTS}回に達しました。${LOCK_MINUTES}分間ロックされます` }, 429);
    }
    await pool.query('UPDATE users SET login_attempts = ? WHERE id = ?', [attempts, user.id]);
    return c.json({ success: false, message: 'メールアドレスまたはパスワードが違います' }, 401);
  }

  // Reset attempts on success.
  await pool.query('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
  const token = await createSessionToken(user.id, user.role ?? 'user');
  return c.json({ success: true, token, role: user.role ?? 'user' });
});

// --- Protected routes --------------------------------------------------------

app.use('/api/settings/*', authMiddleware);
app.use('/api/tasks', authMiddleware);
app.use('/api/tasks/*', authMiddleware);
app.use('/api/events', authMiddleware);
app.use('/api/events/*', authMiddleware);
app.use('/api/ai/*', authMiddleware);

app.get('/api/settings/me', async (c) => {
  const userId = c.get('userId');
  const [rows] = await pool.query<any[]>('SELECT email, role FROM users WHERE id = ?', [userId]);
  return c.json({ email: rows[0]?.email ?? null, role: rows[0]?.role ?? 'user' });
});

app.put('/api/settings/password', async (c) => {
  const userId = c.get('userId');
  const { newPassword } = await c.req.json<{ newPassword?: string }>();
  if (!newPassword || newPassword.length < 8) {
    return c.json({ success: false, message: 'パスワードは8文字以上にしてください' }, 400);
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
  return c.json({ success: true });
});

// --- Admin -------------------------------------------------------------------

app.use('/api/admin/*', adminMiddleware);

// Check if admin account exists (used by register page to show/hide admin option).
app.get('/api/admin/exists', (c) => {
  // This is a public endpoint — no auth needed.
  return c.json({ exists: false }); // placeholder; real check below
});
app.get('/api/auth/admin-exists', async (c) => {
  const [rows] = await pool.query<any[]>(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  return c.json({ exists: rows.length > 0 });
});

app.get('/api/admin/users', async (c) => {
  const [rows] = await pool.query<any[]>(
    `SELECT id, email, role, is_suspended, email_verified, created_at,
       (SELECT COUNT(*) FROM tasks WHERE tasks.user_id = users.id) AS task_count,
       (SELECT COUNT(*) FROM events WHERE events.user_id = users.id) AS event_count
     FROM users ORDER BY created_at ASC`
  );
  return c.json(rows);
});

app.get('/api/admin/users/:id/tasks', async (c) => {
  const targetId = c.req.param('id');
  const [rows] = await pool.query(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY deadline ASC',
    [targetId]
  );
  return c.json(rows);
});

app.get('/api/admin/users/:id/events', async (c) => {
  const targetId = c.req.param('id');
  const [rows] = await pool.query(
    'SELECT * FROM events WHERE user_id = ? ORDER BY start_dt ASC',
    [targetId]
  );
  return c.json(rows);
});

app.put('/api/admin/users/:id/suspend', async (c) => {
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

app.put('/api/admin/users/:id/unsuspend', async (c) => {
  const targetId = c.req.param('id');
  await pool.query('UPDATE users SET is_suspended = FALSE WHERE id = ?', [targetId]);
  return c.json({ success: true });
});

app.delete('/api/admin/users/:id', async (c) => {
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

// --- Tasks -------------------------------------------------------------------

app.get('/api/tasks', async (c) => {
  const userId = c.get('userId');
  const [rows] = await pool.query(
    'SELECT * FROM tasks WHERE user_id = ? AND is_completed = FALSE ORDER BY sort_order ASC, deadline ASC',
    [userId]
  );
  return c.json(rows);
});

app.post('/api/tasks', async (c) => {
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

app.put('/api/tasks/reorder', async (c) => {
  const userId = c.get('userId');
  const { orders } = await c.req.json<{ orders: { id: string; sort_order: number }[] }>();
  for (const item of orders) {
    await pool.query('UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?', [item.sort_order, item.id, userId]);
  }
  return c.json({ success: true });
});

app.put('/api/tasks/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { title, deadline, repeat_type, is_completed, color } = await c.req.json<{
    title: string; deadline: string; repeat_type: RepeatType; is_completed: boolean; color?: string;
  }>();
  if (!title?.trim() || !deadline) {
    return c.json({ success: false, message: 'タスク名と締め切りは必須です' }, 400);
  }
  await pool.query(
    'UPDATE tasks SET title = ?, deadline = ?, repeat_type = ?, is_completed = ?, color = ?, reminder_sent_at = NULL WHERE id = ? AND user_id = ?',
    [title.trim(), toMysqlDatetime(deadline), repeat_type ?? 'none', is_completed ? 1 : 0, color ?? null, id, userId]
  );
  if (is_completed && repeat_type && repeat_type !== 'none') {
    const next = nextDeadline(parseDeadline(deadline), repeat_type);
    if (next) {
      await pool.query(
        'INSERT INTO tasks (id, user_id, title, deadline, repeat_type, sort_order) VALUES (?, ?, ?, ?, ?, 0)',
        [crypto.randomUUID(), userId, title.trim(), toMysqlDatetime(next), repeat_type]
      );
    }
  }
  return c.json({ success: true });
});

app.delete('/api/tasks/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  await pool.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  return c.json({ success: true });
});

// --- Events ------------------------------------------------------------------

app.get('/api/events', async (c) => {
  const userId = c.get('userId');
  const now = jstNowAsDatetime();
  const [rows] = await pool.query(
    'SELECT * FROM events WHERE user_id = ? AND end_dt >= ? ORDER BY start_dt ASC',
    [userId, now]
  );
  return c.json(rows);
});

app.post('/api/events', async (c) => {
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

app.put('/api/events/:id', async (c) => {
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

app.delete('/api/events/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  await pool.query('DELETE FROM events WHERE id = ? AND user_id = ?', [id, userId]);
  return c.json({ success: true });
});

app.post('/api/events/:id/complete', async (c) => {
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

// --- AI Parse ----------------------------------------------------------------

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
[{"type":"task"|"event","title":"...","deadline":"YYYY-MM-DDTHH:MM"(task),"start_dt":"..."(event),"end_dt":"..."(event),"memo":"...","repeat_type":"none"|"daily"|"weekly"|"yearly"}]
日時が不明な場合は合理的に推測すること。必ずJSON配列のみ返すこと。`
    : `あなたはタスク・予定管理AIです。ユーザーの入力から1つのタスクまたは予定を抽出してJSON形式で返してください。
現在の日時（JST）: ${nowJst}
以下の形式で返すこと:
{"type":"task"|"event","title":"...","deadline":"YYYY-MM-DDTHH:MM"(task),"start_dt":"..."(event),"end_dt":"..."(event),"memo":"...","repeat_type":"none"|"daily"|"weekly"|"yearly"}
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
  const userId = c.get('userId');
  const { endpoint, keys } = await c.req.json<{
    endpoint: string; keys: { p256dh: string; auth: string };
  }>();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json({ success: false, message: '購読情報が不正です' }, 400);
  }
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = ?, p256dh = ?, auth = ?`,
    [userId, endpoint, keys.p256dh, keys.auth, userId, keys.p256dh, keys.auth]
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

// --- Startup -----------------------------------------------------------------

const port = Number(process.env.PORT ?? 3000);

initDB()
  .then(async () => {
    // Migrate legacy INT-id user row to UUID if needed.
    const [legacyRows] = await pool.query<any[]>(
      `SELECT id FROM users WHERE email IS NULL LIMIT 1`
    );
    if (legacyRows.length === 0) {
      // No legacy user — check if there's truly no user at all.
      const [allRows] = await pool.query<any[]>('SELECT COUNT(*) AS cnt FROM users');
      if (allRows[0].cnt === 0) {
        // Fresh install — no seed needed; users register via /api/auth/register.
        console.log('Fresh install: no seed user created.');
      }
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
