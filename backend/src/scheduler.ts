import cron from 'node-cron';
import { pool } from './db.js';
import { sendNotificationToAll } from './push.js';

const REMINDER_WINDOW_MINUTES = 60;

// Every 5 minutes: notify about tasks whose deadline is within the next hour.
function startDeadlineReminder() {
  cron.schedule('*/5 * * * *', async () => {
    const [rows] = await pool.query<any[]>(
      `SELECT id, title, deadline FROM tasks
       WHERE is_completed = FALSE
         AND reminder_sent_at IS NULL
         AND deadline <= DATE_ADD(NOW(), INTERVAL ? MINUTE)
         AND deadline >= NOW()`,
      [REMINDER_WINDOW_MINUTES]
    );

    for (const task of rows) {
      await sendNotificationToAll({
        title: '締め切りが近づいています',
        body: `「${task.title}」の締め切りが近づいています`,
        url: '/dashboard',
      });
      await pool.query('UPDATE tasks SET reminder_sent_at = NOW() WHERE id = ?', [task.id]);
    }
  });
}

// Every day at 00:00: notify about tasks due today.
function startDailySummary() {
  cron.schedule('0 0 * * *', async () => {
    const [rows] = await pool.query<any[]>(
      `SELECT id, title FROM tasks
       WHERE is_completed = FALSE
         AND deadline >= CURDATE()
         AND deadline < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );

    if (rows.length === 0) return;

    const body =
      rows.length === 1
        ? `今日締め切り: ${rows[0].title}`
        : `今日締め切りのタスクが${rows.length}件あります: ${rows.map((r) => r.title).join('、')}`;

    await sendNotificationToAll({
      title: '今日の締め切りタスク',
      body,
      url: '/dashboard',
    });
  });
}

export function startScheduler() {
  startDeadlineReminder();
  startDailySummary();
}
