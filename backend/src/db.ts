import mysql from 'mysql2/promise';

// Railway's MySQL plugin exposes a connection string via MYSQL_URL/DATABASE_URL.
// Falls back to discrete DB_* vars for local development.
const connectionUrl = process.env.MYSQL_URL ?? process.env.DATABASE_URL;

const pool = connectionUrl
  ? mysql.createPool({ uri: connectionUrl, waitForConnections: true, connectionLimit: 10 })
  : mysql.createPool({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3307),
      user: process.env.DB_USER ?? 'user',
      password: process.env.DB_PASSWORD ?? 'password',
      database: process.env.DB_NAME ?? 'todo_db',
      waitForConnections: true,
      connectionLimit: 10,
    });

export async function initDB() {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NULL UNIQUE,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        password_hash VARCHAR(255) NOT NULL,
        login_attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate legacy single-user row: add missing columns if they don't exist.
    const [emailCol] = await connection.query<any[]>(`SHOW COLUMNS FROM users LIKE 'email'`);
    if (emailCol.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL UNIQUE`);
      await connection.query(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE`);
      await connection.query(`ALTER TABLE users ADD COLUMN login_attempts INT NOT NULL DEFAULT 0`);
      await connection.query(`ALTER TABLE users ADD COLUMN locked_until DATETIME NULL`);
      await connection.query(`ALTER TABLE users ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      // Give legacy row a UUID primary key (id column was INT, need to re-create).
      // Safest: just add cols and leave PK as INT for existing table.
    }
    const [idCol] = await connection.query<any[]>(`SHOW COLUMNS FROM users LIKE 'id'`);
    if (idCol.length > 0 && idCol[0].Type === 'int') {
      // Legacy INT id — add uuid column and migrate
      const [uuidCol] = await connection.query<any[]>(`SHOW COLUMNS FROM users LIKE 'uuid'`);
      if (uuidCol.length === 0) {
        await connection.query(`ALTER TABLE users ADD COLUMN uuid VARCHAR(36) NULL`);
        await connection.query(`UPDATE users SET uuid = UUID() WHERE uuid IS NULL`);
      }
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code CHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        deadline DATETIME NOT NULL,
        repeat_type VARCHAR(20) NOT NULL DEFAULT 'none',
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        color VARCHAR(20) NULL,
        reminder_sent_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns introduced after the initial release.
    const [reminderCol] = await connection.query<any[]>(`SHOW COLUMNS FROM tasks LIKE 'reminder_sent_at'`);
    if (reminderCol.length === 0) {
      await connection.query(`ALTER TABLE tasks ADD COLUMN reminder_sent_at DATETIME NULL`);
    }
    const [taskColorCol] = await connection.query<any[]>(`SHOW COLUMNS FROM tasks LIKE 'color'`);
    if (taskColorCol.length === 0) {
      await connection.query(`ALTER TABLE tasks ADD COLUMN color VARCHAR(20) NULL`);
    }
    const [taskUserCol] = await connection.query<any[]>(`SHOW COLUMNS FROM tasks LIKE 'user_id'`);
    if (taskUserCol.length === 0) {
      // Assign legacy rows to the first user found.
      await connection.query(`ALTER TABLE tasks ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT ''`);
      await connection.query(`UPDATE tasks t SET t.user_id = (SELECT id FROM users LIMIT 1) WHERE t.user_id = ''`);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        start_dt DATETIME NOT NULL,
        end_dt DATETIME NOT NULL,
        memo TEXT NULL,
        repeat_type VARCHAR(20) NOT NULL DEFAULT 'none',
        color VARCHAR(20) NULL,
        reminder_sent_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [eventColorCol] = await connection.query<any[]>(`SHOW COLUMNS FROM events LIKE 'color'`);
    if (eventColorCol.length === 0) {
      await connection.query(`ALTER TABLE events ADD COLUMN color VARCHAR(20) NULL`);
    }
    const [eventUserCol] = await connection.query<any[]>(`SHOW COLUMNS FROM events LIKE 'user_id'`);
    if (eventUserCol.length === 0) {
      await connection.query(`ALTER TABLE events ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT ''`);
      await connection.query(`UPDATE events e SET e.user_id = (SELECT id FROM users LIMIT 1) WHERE e.user_id = ''`);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        endpoint VARCHAR(500) NOT NULL UNIQUE,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [pushUserCol] = await connection.query<any[]>(`SHOW COLUMNS FROM push_subscriptions LIKE 'user_id'`);
    if (pushUserCol.length === 0) {
      await connection.query(`ALTER TABLE push_subscriptions ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT ''`);
      await connection.query(`UPDATE push_subscriptions SET user_id = (SELECT id FROM users LIMIT 1) WHERE user_id = ''`);
    }
  } finally {
    connection.release();
  }
}

export { pool };
