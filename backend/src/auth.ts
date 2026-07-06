import { SignJWT, jwtVerify } from 'jose';
import type { Context, Next } from 'hono';
import { pool } from './db.js';

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
};

// Shorter session lifetime limits the blast radius of a leaked token (H3).
const SESSION_TTL = '7d';

export async function createSessionToken(userId: string, role: string = 'user') {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey());
}

function bearer(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

// Verifies the JWT AND re-checks live account state on every request so a
// suspended or deleted account cannot keep using a previously-issued token (H3).
// Returns the user's state on success, or a Response to short-circuit on failure.
async function authenticate(
  c: Context
): Promise<{ userId: string; role: string; mustChange: boolean } | Response> {
  const token = bearer(c);
  if (!token) {
    return c.json({ success: false, message: '認証が必要です' }, 401);
  }

  let sub: string;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    sub = payload.sub as string;
  } catch {
    return c.json({ success: false, message: '認証トークンが無効です' }, 401);
  }

  const [rows] = await pool.query<any[]>(
    'SELECT id, role, is_suspended, must_change_password FROM users WHERE id = ?',
    [sub]
  );
  const user = rows[0];
  if (!user) {
    return c.json({ success: false, message: 'アカウントが見つかりません' }, 401);
  }
  if (user.is_suspended) {
    return c.json({ success: false, message: 'このアカウントは停止されています' }, 403);
  }

  return { userId: user.id, role: user.role ?? 'user', mustChange: !!user.must_change_password };
}

export async function authMiddleware(c: Context, next: Next) {
  const result = await authenticate(c);
  if (result instanceof Response) return result;

  // C1 enforcement: an account still on a server-set default password may only
  // reach the password-change endpoint until it sets its own password.
  if (result.mustChange && !(c.req.method === 'PUT' && c.req.path === '/api/settings/password')) {
    return c.json({ success: false, message: 'パスワードの変更が必要です', mustChangePassword: true }, 403);
  }

  c.set('userId', result.userId);
  c.set('userRole', result.role);
  await next();
}

export async function adminMiddleware(c: Context, next: Next) {
  const result = await authenticate(c);
  if (result instanceof Response) return result;

  if (result.role !== 'admin') {
    return c.json({ success: false, message: '管理者権限が必要です' }, 403);
  }

  c.set('userId', result.userId);
  c.set('userRole', result.role);
  await next();
}
