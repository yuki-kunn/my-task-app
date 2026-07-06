import mysql from 'mysql2/promise';

// Railway's MySQL plugin exposes a connection string via MYSQL_URL/DATABASE_URL.
// Falls back to discrete DB_* vars for local development.
const connectionUrl = process.env.MYSQL_URL ?? process.env.DATABASE_URL;

// I1: the app stores datetimes as UTC and compares them against MySQL NOW().
// Pin every connection's session timezone to UTC so behaviour no longer depends
// on the DB server's configured timezone (auth-code expiry, lockout, reminders).
const pool = connectionUrl
  ? mysql.createPool({ uri: connectionUrl, timezone: 'Z', waitForConnections: true, connectionLimit: 10 })
  : mysql.createPool({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3307),
      user: process.env.DB_USER ?? 'user',
      password: process.env.DB_PASSWORD ?? 'password',
      database: process.env.DB_NAME ?? 'todo_db',
      timezone: 'Z',
      waitForConnections: true,
      connectionLimit: 10,
    });

// mysql2's `timezone` option only affects how JS Date values are serialized; it
// does NOT change what NOW()/CURRENT_TIMESTAMP return. Force the SESSION time_zone
// to UTC on every pooled connection so server-side NOW() matches our stored UTC.
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
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
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
        login_attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        display_name VARCHAR(50) NULL,
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate: add role / is_suspended columns if missing.
    const [roleCol] = await connection.query<any[]>(`SHOW COLUMNS FROM users LIKE 'role'`);
    if (roleCol.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'`);
    }
    const [suspendedCol] = await connection.query<any[]>(`SHOW COLUMNS FROM users LIKE 'is_suspended'`);
    if (suspendedCol.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT FALSE`);
    }
    const [displayNameCol] = await connection.query<any[]>(`SHOW COLUMNS FROM users LIKE 'display_name'`);
    if (displayNameCol.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN display_name VARCHAR(50) NULL`);
    }
    // Forces the user to set their own password before using the app (C1 fix).
    const [mustChangeCol] = await connection.query<any[]>(`SHOW COLUMNS FROM users LIKE 'must_change_password'`);
    if (mustChangeCol.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE`);
    }

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
    // Legacy INT id migration: rebuild users table with VARCHAR(36) primary key.
    const [idCol] = await connection.query<any[]>(`SHOW COLUMNS FROM users LIKE 'id'`);
    if (idCol.length > 0 && idCol[0].Type.startsWith('int')) {
      // 1. 旧データを退避
      const [oldUsers] = await connection.query<any[]>(`SELECT * FROM users`);

      // 2. 依存テーブルの外部キー制約を一時無効化
      await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);

      // 3. 旧テーブルを削除して新スキーマで再作成
      await connection.query(`DROP TABLE users`);
      await connection.query(`
        CREATE TABLE users (
          id VARCHAR(36) PRIMARY KEY,
          email VARCHAR(255) NULL UNIQUE,
          email_verified BOOLEAN NOT NULL DEFAULT FALSE,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'user',
          is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
          login_attempts INT NOT NULL DEFAULT 0,
          locked_until DATETIME NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 4. 旧データを新スキーマに移行（UUIDを新たに割り当て）
      for (const u of oldUsers) {
        const newId = crypto.randomUUID();
        await connection.query(
          `INSERT INTO users (id, email, email_verified, password_hash, role, login_attempts, created_at)
           VALUES (?, ?, ?, ?, 'user', 0, NOW())`,
          [newId, u.email ?? null, u.email_verified ?? false, u.password_hash]
        );
        // tasks / events / push_subscriptions の user_id も更新
        await connection.query(`UPDATE tasks SET user_id = ? WHERE user_id = ?`, [newId, String(u.id)]);
        await connection.query(`UPDATE events SET user_id = ? WHERE user_id = ?`, [newId, String(u.id)]);
        await connection.query(`UPDATE push_subscriptions SET user_id = ? WHERE user_id = ?`, [newId, String(u.id)]);
      }

      await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);
      console.log('Legacy users table migrated to VARCHAR(36) primary key.');
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code CHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // H2: track wrong-code attempts to throttle brute force.
    const [attemptsCol] = await connection.query<any[]>(`SHOW COLUMNS FROM email_verifications LIKE 'attempts'`);
    if (attemptsCol.length === 0) {
      await connection.query(`ALTER TABLE email_verifications ADD COLUMN attempts INT NOT NULL DEFAULT 0`);
    }

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

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        used_date DATE NOT NULL,
        count INT NOT NULL DEFAULT 0,
        UNIQUE KEY uq_user_date (user_id, used_date)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_colors (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        hex CHAR(7) NOT NULL,
        name VARCHAR(50) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_colors_user (user_id)
      )
    `);
  } finally {
    connection.release();
  }
}

export { pool };
