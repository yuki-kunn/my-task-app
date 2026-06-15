import cron from 'node-cron';
import { pool } from './db.js';
import { sendNotificationToAll } from './push.js';

const REMINDER_WINDOW_MINUTES = 60;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Task deadlines are stored as JST wall-clock values written as if they were
// UTC (see backend/src/index.ts). To compare against "now", we need the
// current JST wall-clock time expressed the same way.
function jstNowAsMysqlDatetime() {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

function jstTodayStart() {
  const jstNow = new Date(Date.now() + JST_OFFSET_MS);
  return `${jstNow.toISOString().slice(0, 10)} 00:00:00`;
}

// Every 5 minutes: notify about tasks whose deadline is within the next hour.
function startDeadlineReminder() {
  cron.schedule('*/5 * * * *', async () => {
    const now = jstNowAsMysqlDatetime();
    const [rows] = await pool.query<any[]>(
      `SELECT id, title, deadline FROM tasks
       WHERE is_completed = FALSE
         AND reminder_sent_at IS NULL
         AND deadline <= DATE_ADD(?, INTERVAL ? MINUTE)
         AND deadline >= ?`,
      [now, REMINDER_WINDOW_MINUTES, now]
    );

    for (const task of rows) {
      await sendNotificationToAll({
        title: '締め切りが近づいています',
        body: `「${task.title}」の締め切りが近づいています`,
        url: '/dashboard',
      });
      await pool.query('UPDATE tasks SET reminder_sent_at = ? WHERE id = ?', [now, task.id]);
    }
  });
}

// Every day at 00:00 JST: notify about tasks due today.
function startDailySummary() {
  // Cron runs in the server's local time (UTC on Railway): 15:00 UTC = 00:00 JST.
  cron.schedule('0 15 * * *', async () => {
    const todayStart = jstTodayStart();
    const [rows] = await pool.query<any[]>(
      `SELECT id, title FROM tasks
       WHERE is_completed = FALSE
         AND deadline >= ?
         AND deadline < DATE_ADD(?, INTERVAL 1 DAY)`,
      [todayStart, todayStart]
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
