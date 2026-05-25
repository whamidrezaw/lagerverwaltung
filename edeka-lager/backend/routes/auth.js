const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const auth    = require('../middleware/auth');

// POST /api/auth/register  — فقط admin می‌تواند کاربر بسازد
// توجه: برای ایجاد کاربر کامل (با telegramChatId و isActive) از /api/users استفاده کنید
router.post('/register', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ message: 'Nur Admins dürfen Benutzer erstellen' });

    const { username, password, name, role, telegramChatId, isActive } = req.body;

    if (!username || !password || !name)
      return res.status(400).json({ message: 'username, password und name sind erforderlich' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Passwort mindestens 6 Zeichen' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: 'Benutzername bereits vergeben' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      password: hashedPassword,
      name,
      role: role || 'lagerist',
      telegramChatId: telegramChatId || null,
      isActive: isActive !== false  // پیش‌فرض: فعال
    });

    res.status(201).json({
      message: 'Benutzer erstellt',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ message: 'Benutzername und Passwort erforderlich' });

    const ip        = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const user = await User.findOne({ username });
    if (!user || !user.isActive)
      return res.status(401).json({ message: 'Benutzername oder Passwort falsch' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: 'Benutzername oder Passwort falsch' });

    // Login-Log speichern (max 50 Einträge)
    const entry = { timestamp: new Date(), ip, userAgent, action: 'login' };
    const history = [entry, ...(user.loginHistory || [])].slice(0, 50);
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      loginHistory: history
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me  — اطلاعات کاربر جاری (بدون رمز و loginHistory)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -loginHistory');
    if (!user) return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/auth/change-password  — تغییر رمز توسط کاربر خودش
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword)
      return res.status(400).json({ message: 'Aktuelles Passwort erforderlich' });
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Neues Passwort muss mindestens 6 Zeichen haben' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Benutzer nicht gefunden' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid)
      return res.status(401).json({ message: 'Aktuelles Passwort falsch' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(user._id, { password: hashed });
    res.json({ message: '✅ Passwort erfolgreich geändert' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
