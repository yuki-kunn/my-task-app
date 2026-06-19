import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { sendVerificationEmail } from '../mailer.js';
import { createSessionToken } from '../auth.js';
import { toMysqlDatetime } from '../helpers.js';

type Variables = { userId: string; userRole: string };
const router = new Hono<{ Variables: Variables }>();

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim().toLowerCase());
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

// Step 1: send verification code to email (or return it in dev/fallback mode).
router.post('/register', async (c) => {
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

  const mailResult = await sendVerificationEmail(normalized, code);
  if (!mailResult.ok) {
    // 送信エラー → フォールバック表示
    return c.json({ success: true, fallback: true, code, resendError: mailResult.error });
  }
  if (mailResult.fallback) {
    // Gmail未設定 → フォールバック表示
    return c.json({ success: true, fallback: true, code });
  }
  return c.json({ success: true, fallback: false });
});

// Step 2: verify code and create account.
// Pass asAdmin=true to register the first admin (allowed only when no admin exists yet).
router.post('/verify', async (c) => {
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
router.post('/login', async (c) => {
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
  // 初期パスワード "pass" のままかチェック（強制変更フロー用）
  const passwordIsDefault = await bcrypt.compare('pass', user.password_hash);
  return c.json({ success: true, token, role: user.role ?? 'user', passwordIsDefault });
});

router.get('/admin-exists', async (c) => {
  const [rows] = await pool.query<any[]>(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  return c.json({ exists: rows.length > 0 });
});

export default router;
