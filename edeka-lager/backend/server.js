require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');

const app = express();

// ── Security ─────────────────────────────────────────────────────
// FIX #4: CSP را فعال نگه داشتیم — فقط static assets و API خودمان مجاز
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],   // فرانت‌اند inline scripts
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "https:"],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'", "https:", "data:"],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false  // برای Excel download
}));

// FIX #3: CORS برای هر دو dev و production
const allowedOrigins = [
  process.env.DOMAIN,           // مثلاً https://deapply.de
  'http://localhost:3000',
  'http://localhost:5500',       // Live Server vscode
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // بدون origin: curl، Postman، server-to-server
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin nicht erlaubt: ${origin}`));
  },
  credentials: true
}));

// ── Body Parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Static Frontend ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/users',    require('./routes/users'));

// ── Health Check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// FIX #1: Express 5 SPA Fallback — '/{*path}' statt '/*'
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// FIX #2: Global Error Handler NACH allen routes (korrekter Platz)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  }
  // CORS-Fehler klar kommunizieren
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ message: err.message });
  }
  res.status(status).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Interner Serverfehler'
      : err.message
  });
});

// ── DB + Server Start ─────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000   // FIX #6: timeout برای سریع‌تر fail
})
  .then(() => {
    console.log('✅ MongoDB verbunden');
    const PORT = parseInt(process.env.PORT) || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server läuft auf Port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Verbindungsfehler:', err.message);
    process.exit(1);
  });
