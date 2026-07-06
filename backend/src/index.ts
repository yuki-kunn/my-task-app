import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { pool, initDB } from './db.js';
import { authMiddleware, adminMiddleware } from './auth.js';
import { startScheduler } from './scheduler.js';
import { isPushConfigured } from './push.js';

import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import eventsRouter from './routes/events.js';
import settingsRouter from './routes/settings.js';
import adminRouter from './routes/admin.js';
import aiRouter from './routes/ai.js';
import colorsRouter from './routes/colors.js';

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

// M2: baseline security headers on every response. This is a JSON API served
// cross-origin from the SPA, so a restrictive CSP that forbids embedding/loading
// is appropriate.
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// I3: a malformed JSON body used to throw an uncaught error → 500 with a stack
// trace in logs. Catch it centrally and return a clean 400.
app.onError((err, c) => {
  if (err instanceof SyntaxError) {
    return c.json({ success: false, message: 'リクエストの形式が不正です' }, 400);
  }
  console.error('Unhandled error:', err);
  return c.json({ success: false, message: 'サーバーエラーが発生しました' }, 500);
});

// --- Health ------------------------------------------------------------------

app.get('/api/health', (c) => c.json({ ok: true }));

// --- Route mounting ----------------------------------------------------------

app.route('/api/auth', authRouter);

app.use('/api/settings/*', authMiddleware);
app.route('/api/settings', settingsRouter);

app.use('/api/tasks', authMiddleware);
app.use('/api/tasks/*', authMiddleware);
app.route('/api/tasks', tasksRouter);

app.use('/api/events', authMiddleware);
app.use('/api/events/*', authMiddleware);
app.route('/api/events', eventsRouter);

app.use('/api/ai/*', authMiddleware);
app.route('/api/ai', aiRouter);

app.use('/api/colors', authMiddleware);
app.use('/api/colors/*', authMiddleware);
app.route('/api/colors', colorsRouter);

app.use('/api/admin/*', adminMiddleware);
app.route('/api/admin', adminRouter);

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
