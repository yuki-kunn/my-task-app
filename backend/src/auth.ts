import { SignJWT, jwtVerify } from 'jose';
import type { Context, Next } from 'hono';

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
};

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId, role: 'user' })
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
    // Attach user_id to context for downstream handlers.
    c.set('userId', payload.sub as string);
  } catch {
    return c.json({ success: false, message: '認証トークンが無効です' }, 401);
  }

  await next();
}
