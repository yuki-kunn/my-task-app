import cron from 'node-cron';
import { pool } from './db.js';
import { sendNotificationToUser } from './push.js';
import { parseDeadline, toMysqlDatetime } from './helpers.js';
import { nextEvent, type RepeatType } from './repeat.js';

const REMINDER_WINDOW_MINUTES = 60;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstNowAsMysqlDatetime() {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

function jstTodayStart() {
  const jstNow = new Date(Date.now() + JST_OFFSET_MS);
  return `${jstNow.toISOString().slice(0, 10)} 00:00:00`;
}

// Every 5 minutes: notify each user about their own tasks/events starting within the next hour.
function startDeadlineReminder() {
  cron.schedule('*/5 * * * *', async () => {
    const now = jstNowAsMysqlDatetime();

    const [taskRows] = await pool.query<any[]>(
      `SELECT id, user_id, title, deadline FROM tasks
       WHERE is_completed = FALSE
         AND reminder_sent_at IS NULL
         AND deadline <= DATE_ADD(?, INTERVAL ? MINUTE)
         AND deadline >= ?`,
      [now, REMINDER_WINDOW_MINUTES, now]
    );

    for (const task of taskRows) {
      await sendNotificationToUser(task.user_id, {
        title: '締め切りが近づいています',
        body: `「${task.title}」の締め切りが近づいています`,
        url: '/dashboard',
      });
      await pool.query('UPDATE tasks SET reminder_sent_at = ? WHERE id = ?', [now, task.id]);
    }

    const [eventRows] = await pool.query<any[]>(
      `SELECT id, user_id, title, start_dt FROM events
       WHERE reminder_sent_at IS NULL
         AND start_dt <= DATE_ADD(?, INTERVAL ? MINUTE)
         AND start_dt >= ?`,
      [now, REMINDER_WINDOW_MINUTES, now]
    );

    for (const event of eventRows) {
      await sendNotificationToUser(event.user_id, {
        title: '予定が近づいています',
        body: `「${event.title}」が間もなく始まります`,
        url: '/dashboard',
      });
      await pool.query('UPDATE events SET reminder_sent_at = ? WHERE id = ?', [now, event.id]);
    }
  });
}

// Every day at 00:00 JST: notify each user about their own tasks and events today.
function startDailySummary() {
  // 15:00 UTC = 00:00 JST
  cron.schedule('0 15 * * *', async () => {
    const todayStart = jstTodayStart();

    // ユーザーごとに今日のタスク・予定をまとめて通知
    const [userRows] = await pool.query<any[]>('SELECT DISTINCT user_id FROM push_subscriptions');

    for (const { user_id } of userRows) {
      const [taskRows] = await pool.query<any[]>(
        `SELECT title FROM tasks
         WHERE user_id = ?
           AND is_completed = FALSE
           AND deadline >= ?
           AND deadline < DATE_ADD(?, INTERVAL 1 DAY)`,
        [user_id, todayStart, todayStart]
      );

      const [eventRows] = await pool.query<any[]>(
        `SELECT title FROM events
         WHERE user_id = ?
           AND start_dt >= ?
           AND start_dt < DATE_ADD(?, INTERVAL 1 DAY)`,
        [user_id, todayStart, todayStart]
      );

      if (taskRows.length === 0 && eventRows.length === 0) continue;

      const parts: string[] = [];
      if (taskRows.length > 0) parts.push(`タスク: ${taskRows.map((r) => r.title).join('、')}`);
      if (eventRows.length > 0) parts.push(`予定: ${eventRows.map((r) => r.title).join('、')}`);

      await sendNotificationToUser(user_id, {
        title: '今日のタスク・予定',
        body: parts.join(' / '),
        url: '/dashboard',
      });
    }
  });
}

// Every day at 00:30 JST: repeating events whose period has ended get their next
// occurrence generated; non-repeating ended events are deleted outright.
function startEndedEventCleanup() {
  // 15:30 UTC = 00:30 JST
  cron.schedule('30 15 * * *', async () => {
    const now = jstNowAsMysqlDatetime();

    const [endedEvents] = await pool.query<any[]>(
      'SELECT * FROM events WHERE end_dt < ?',
      [now]
    );

    for (const event of endedEvents) {
      const repeatType = event.repeat_type as RepeatType;
      if (repeatType && repeatType !== 'none') {
        const next = nextEvent(parseDeadline(event.start_dt), parseDeadline(event.end_dt), repeatType);
        if (next) {
          await pool.query(
            'INSERT INTO events (id, user_id, title, start_dt, end_dt, memo, repeat_type, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), event.user_id, event.title, toMysqlDatetime(next.start), toMysqlDatetime(next.end), event.memo, repeatType, event.color]
          );
        }
      }
      await pool.query('DELETE FROM events WHERE id = ?', [event.id]);
    }
  });
}

export function startScheduler() {
  startDeadlineReminder();
  startDailySummary();
  startEndedEventCleanup();
}
