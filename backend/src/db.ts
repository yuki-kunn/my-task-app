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
        id INT AUTO_INCREMENT PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        deadline DATETIME NOT NULL,
        repeat_type VARCHAR(20) NOT NULL DEFAULT 'none',
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        reminder_sent_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CREATE TABLE IF NOT EXISTS doesn't alter existing tables, so add columns
    // introduced after the initial release if they're missing.
    const [reminderCol] = await connection.query<any[]>(`SHOW COLUMNS FROM tasks LIKE 'reminder_sent_at'`);
    if (reminderCol.length === 0) {
      await connection.query(`ALTER TABLE tasks ADD COLUMN reminder_sent_at DATETIME NULL`);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        start_dt DATETIME NOT NULL,
        end_dt DATETIME NOT NULL,
        memo TEXT NULL,
        repeat_type VARCHAR(20) NOT NULL DEFAULT 'none',
        reminder_sent_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        endpoint VARCHAR(500) NOT NULL UNIQUE,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    connection.release();
  }
}

export { pool };
