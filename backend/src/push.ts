import webpush from 'web-push';
import { pool } from './db.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export function isPushConfigured() {
  return !!(vapidPublicKey && vapidPrivateKey);
}

// 特定ユーザーにのみ通知を送る
export async function sendNotificationToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!isPushConfigured()) return;

  const [rows] = await pool.query<any[]>(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    [userId]
  );

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
        } else {
          console.error('Push notification failed:', err);
        }
      }
    })
  );
}
