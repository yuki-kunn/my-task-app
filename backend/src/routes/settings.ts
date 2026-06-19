import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

type Variables = { userId: string; userRole: string };
const router = new Hono<{ Variables: Variables }>();

const BCRYPT_ROUNDS = 12;

router.get('/me', async (c) => {
  const userId = c.get('userId');
  const [rows] = await pool.query<any[]>('SELECT email, role FROM users WHERE id = ?', [userId]);
  return c.json({ email: rows[0]?.email ?? null, role: rows[0]?.role ?? 'user' });
});

router.put('/password', async (c) => {
  const userId = c.get('userId');
  const { newPassword } = await c.req.json<{ newPassword?: string }>();
  if (!newPassword || newPassword.length < 8) {
    return c.json({ success: false, message: 'パスワードは8文字以上にしてください' }, 400);
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
  return c.json({ success: true });
});

export default router;
