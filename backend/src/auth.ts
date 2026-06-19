import { SignJWT, jwtVerify } from 'jose';
import type { Context, Next } from 'hono';

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
};

export async function createSessionToken(userId: string, role: string = 'user') {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecretKey());
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ success: false, message: '認証が必要です' }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    c.set('userId', payload.sub as string);
    c.set('userRole', payload.role as string);
  } catch {
    return c.json({ success: false, message: '認証トークンが無効です' }, 401);
  }

  await next();
}

export async function adminMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ success: false, message: '認証が必要です' }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.role !== 'admin') {
      return c.json({ success: false, message: '管理者権限が必要です' }, 403);
    }
    c.set('userId', payload.sub as string);
    c.set('userRole', payload.role as string);
  } catch {
    return c.json({ success: false, message: '認証トークンが無効です' }, 401);
  }

  await next();
}
