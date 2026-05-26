const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = {
  createTable: async () => {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        name             VARCHAR(100) NOT NULL,
        username         VARCHAR(50)  NOT NULL UNIQUE,
        password         VARCHAR(255) NOT NULL,
        role             ENUM('admin','employee') NOT NULL DEFAULT 'employee',
        employment_type  ENUM('minijob','teilzeit','vollzeit') NOT NULL DEFAULT 'teilzeit',
        weekly_hours     DECIMAL(4,1) NOT NULL DEFAULT 20.0,
        hour_balance     DECIMAL(6,1) NOT NULL DEFAULT 0.0,
        email            VARCHAR(150),
        phone            VARCHAR(30),
        notes            VARCHAR(500),
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order       INT NOT NULL DEFAULT 0,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  },

  migrate: async () => {
    const cols = [
      `ALTER TABLE users ADD COLUMN hour_balance DECIMAL(6,1) NOT NULL DEFAULT 0.0 AFTER weekly_hours`,
      `ALTER TABLE users ADD COLUMN notes VARCHAR(500) NULL AFTER phone`,
      `ALTER TABLE users ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER is_active`,
    ];
    for (const sql of cols) {
      try { await pool.execute(sql); }
      catch(e) { /* already exists */ }
    }
  },

  findByUsername: async (u) => {
    const [r] = await pool.execute('SELECT * FROM users WHERE username=? AND is_active=TRUE',[u]);
    return r[0]||null;
  },

  findById: async (id) => {
    const [r] = await pool.execute(
      'SELECT id,name,username,role,employment_type,weekly_hours,hour_balance,email,phone,notes,is_active,sort_order FROM users WHERE id=?',[id]
    );
    return r[0]||null;
  },

  findAll: async () => {
    const [r] = await pool.execute(
      'SELECT id,name,username,role,employment_type,weekly_hours,hour_balance,email,phone,notes,is_active,sort_order FROM users ORDER BY sort_order ASC, name ASC'
    );
    return r;
  },

  create: async ({ name, username, password, role, employment_type, weekly_hours, email, phone }) => {
    const h = await bcrypt.hash(password, 12);
    const [res] = await pool.execute(
      `INSERT INTO users (name,username,password,role,employment_type,weekly_hours,email,phone) VALUES (?,?,?,?,?,?,?,?)`,
      [name, username, h, role||'employee', employment_type, weekly_hours, email||null, phone||null]
    );
    return res.insertId;
  },

  update: async (id, fields) => {
    const allowed = ['name','username','email','phone','employment_type','weekly_hours','is_active','notes'];
    const updates=[], values=[];
    for (const k of allowed) {
      if (fields[k]!==undefined) { updates.push(`${k}=?`); values.push(fields[k]); }
    }
    if (!updates.length) return false;
    values.push(id);
    await pool.execute(`UPDATE users SET ${updates.join(',')} WHERE id=?`, values);
    return true;
  },

  updateBalance: async (id, balance) => {
    await pool.execute('UPDATE users SET hour_balance=? WHERE id=?',[parseFloat(balance),id]);
  },

  updateSortOrder: async (orderedIds) => {
    for (let i=0; i<orderedIds.length; i++) {
      await pool.execute('UPDATE users SET sort_order=? WHERE id=?',[i, orderedIds[i]]);
    }
  },

  updatePassword: async (id, pw) => {
    const h = await bcrypt.hash(pw, 12);
    await pool.execute('UPDATE users SET password=? WHERE id=?',[h,id]);
  },

  deleteUser: async (id) => {
    // Shifts werden durch ON DELETE CASCADE automatisch gelöscht
    await pool.execute('DELETE FROM users WHERE id=?',[id]);
  },

  verifyPassword: async (plain, hash) => bcrypt.compare(plain, hash),
};

module.exports = User;
