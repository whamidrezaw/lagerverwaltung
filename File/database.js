const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+01:00',
  dateStrings: true,   // ← DATE/DATETIME kommen als "2026-05-20" String zurück, kein UTC-Shift!
});

const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Datenbank verbunden');
    conn.release();
  } catch (err) {
    console.error('❌ Datenbankfehler:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
