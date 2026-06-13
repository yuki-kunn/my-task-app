import mysql from 'mysql2/promise';

const pool = mysql.createPool({
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
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    connection.release();
  }
}

export { pool };
