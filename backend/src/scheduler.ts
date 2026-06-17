import cron from 'node-cron';
import { pool } from './db.js';
import { sendNotificationToAll } from './push.js';

const REMINDER_WINDOW_MINUTES = 60;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Task/event datetimes are stored as JST wall-clock values written as if they
// were UTC (see backend/src/index.ts). To compare against "now", we need the
// current JST wall-clock time expressed the same way.
function jstNowAsMysqlDatetime() {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

function jstTodayStart() {
  const jstNow = new Date(Date.now() + JST_OFFSET_MS);
  return `${jstNow.toISOString().slice(0, 10)} 00:00:00`;
}

// Every 5 minutes: notify about tasks/events starting within the next hour.
function startDeadlineReminder() {
  cron.schedule('*/5 * * * *', async () => {
    const now = jstNowAsMysqlDatetime();

    const [taskRows] = await pool.query<any[]>(
      `SELECT id, title, deadline FROM tasks
       WHERE is_completed = FALSE
         AND reminder_sent_at IS NULL
         AND deadline <= DATE_ADD(?, INTERVAL ? MINUTE)
         AND deadline >= ?`,
      [now, REMINDER_WINDOW_MINUTES, now]
    );

    for (const task of taskRows) {
      await sendNotificationToAll({
        title: '締め切りが近づいています',
        body: `「${task.title}」の締め切りが近づいています`,
        url: '/dashboard',
      });
      await pool.query('UPDATE tasks SET reminder_sent_at = ? WHERE id = ?', [now, task.id]);
    }

    const [eventRows] = await pool.query<any[]>(
      `SELECT id, title, start_dt FROM events
       WHERE reminder_sent_at IS NULL
         AND start_dt <= DATE_ADD(?, INTERVAL ? MINUTE)
         AND start_dt >= ?`,
      [now, REMINDER_WINDOW_MINUTES, now]
    );

    for (const event of eventRows) {
      await sendNotificationToAll({
        title: '予定が近づいています',
        body: `「${event.title}」が間もなく始まります`,
        url: '/dashboard',
      });
      await pool.query('UPDATE events SET reminder_sent_at = ? WHERE id = ?', [now, event.id]);
    }
  });
}

// Every day at 00:00 JST: notify about tasks and events today.
function startDailySummary() {
  // Cron runs in the server's local time (UTC on Railway): 15:00 UTC = 00:00 JST.
  cron.schedule('0 15 * * *', async () => {
    const todayStart = jstTodayStart();

    const [taskRows] = await pool.query<any[]>(
      `SELECT title FROM tasks
       WHERE is_completed = FALSE
         AND deadline >= ?
         AND deadline < DATE_ADD(?, INTERVAL 1 DAY)`,
      [todayStart, todayStart]
    );

    const [eventRows] = await pool.query<any[]>(
      `SELECT title FROM events
       WHERE start_dt >= ?
         AND start_dt < DATE_ADD(?, INTERVAL 1 DAY)`,
      [todayStart, todayStart]
    );

    if (taskRows.length === 0 && eventRows.length === 0) return;

    const parts: string[] = [];
    if (taskRows.length > 0) {
      parts.push(`タスク: ${taskRows.map((r) => r.title).join('、')}`);
    }
    if (eventRows.length > 0) {
      parts.push(`予定: ${eventRows.map((r) => r.title).join('、')}`);
    }

    await sendNotificationToAll({
      title: '今日のタスク・予定',
      body: parts.join(' / '),
      url: '/dashboard',
    });
  });
}

export function startScheduler() {
  startDeadlineReminder();
  startDailySummary();
}
