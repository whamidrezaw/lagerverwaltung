const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const Product   = require('../models/Product');
const DailyLog  = require('../models/DailyLog');
const ExcelJS   = require('exceljs');

// ── helper: Snapshot-Objekt bauen ────────────────────────────────
function buildSnapshot(products, userId) {
  return {
    snapshot: products.map(p => ({
      productId:    p._id,
      productName:  p.name,
      emoji:        p.emoji        || '📦',
      category:     p.category     || 'Sonstige',
      openingStock: p.yesterdayStock ?? 0,
      closingStock: p.currentStock  ?? 0,
      consumed:     Math.max(0, (p.yesterdayStock ?? 0) - (p.currentStock ?? 0)),
      unit:         p.unit         || 'Kiste',
      minStock:     p.minStock     ?? 5,
      isBio:        !!p.isBio,
      isLoose:      !!p.isLoose
    })),
    createdBy:  userId,
    reportSent: false
  };
}

// ── helper: Telegram-Nachricht senden ────────────────────────────
async function sendTelegram(text, chatId = null) {
  const botToken  = process.env.TELEGRAM_BOT_TOKEN;
  const defaultId = process.env.TELEGRAM_CHAT_ID;
  const target    = chatId || defaultId;

  if (!botToken || !target)
    throw new Error('Telegram nicht konfiguriert (.env fehlt: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)');

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    target,
      text,
      parse_mode: 'Markdown'   // FIX: parse_mode hinzugefügt → \n und *bold* funktionieren
    })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok)
    throw new Error(data?.description || `Telegram-Fehler (${res.status})`);

  return data;
}

// ── helper: Telegram-Nachrichtentext erstellen ───────────────────
function buildTelegramText(products) {
  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const totalStock    = products.reduce((s, p) => s + (p.currentStock  ?? 0), 0);
  const totalConsumed = products.reduce((s, p) => s + Math.max(0, (p.yesterdayStock ?? 0) - (p.currentStock ?? 0)), 0);
  const critical      = products.filter(p => (p.currentStock ?? 0) <= 0);
  const low           = products.filter(p => (p.currentStock ?? 0) > 0 && (p.currentStock ?? 0) <= p.minStock);
  const ok            = products.filter(p => (p.currentStock ?? 0) > p.minStock);

  // FIX: echte \n-Zeichen verwenden (kein escaped \\n)
  const lines = [
    `🛒 *EDEKA Lagerbericht*`,
    `📅 ${today}`,
    ``,
    `📦 Gesamtbestand: *${totalStock} Kisten*`,
    `📉 Verbrauch heute: *${totalConsumed} Kisten*`,
    `✅ OK: ${ok.length} | ⚠️ Niedrig: ${low.length} | 🔴 Kritisch: ${critical.length}`,
    ``
  ];

  if (critical.length > 0) {
    lines.push(`🔴 *KRITISCH — Sofort bestellen:*`);
    critical.forEach(p => lines.push(`  ${p.emoji} ${p.name}: *0 Kisten*`));
    lines.push(``);
  }
  if (low.length > 0) {
    lines.push(`⚠️ *NIEDRIG — Nachbestellen:*`);
    low.forEach(p => lines.push(`  ${p.emoji} ${p.name}: ${p.currentStock}/${p.minStock} Kisten`));
    lines.push(``);
  }

  lines.push(`📊 *Alle Artikel:*`);
  const categories = [...new Set(products.map(p => p.category))];
  categories.forEach(cat => {
    lines.push(`\n*${cat}*`);
    products.filter(p => p.category === cat).forEach(p => {
      const consumed = Math.max(0, (p.yesterdayStock ?? 0) - (p.currentStock ?? 0));
      const icon = (p.currentStock ?? 0) <= 0 ? '🔴'
                 : (p.currentStock ?? 0) <= p.minStock ? '⚠️' : '✅';
      let line = `${icon} ${p.emoji} ${p.name}: ${p.currentStock} ${p.unit || 'Kiste'}`;
      if (consumed > 0) line += ` (−${consumed})`;
      lines.push(line);
    });
  });

  lines.push(``);
  lines.push(`⏰ _Bericht gesendet um ${new Date().toLocaleTimeString('de-DE')}_`);

  return lines.join('\n');
}

// ── GET /api/reports/daily ───────────────────────────────────────
router.get('/daily', auth, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ category: 1 });
    const report = products.map(p => ({
      name:          p.name,
      emoji:         p.emoji,
      category:      p.category,
      currentStock:  p.currentStock,
      yesterdayStock: p.yesterdayStock,
      consumed:      Math.max(0, (p.yesterdayStock ?? 0) - (p.currentStock ?? 0)),
      status:        p.status,
      unit:          p.unit,
      isBio:         p.isBio,
      isLoose:       p.isLoose
    }));
    res.json({ date: new Date().toISOString().split('T')[0], products: report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/reports/analytics?days=7 ───────────────────────────
router.get('/analytics', auth, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const logs = await DailyLog.find().sort({ date: -1 }).limit(days);
    if (logs.length === 0)
      return res.json({ logs: [], summary: {}, topProducts: [], allProducts: [] });

    const dailyTotals = logs.map(log => ({
      date:          log.date,
      totalConsumed: log.snapshot.reduce((s, p) => s + (p.consumed || 0), 0),
      totalStock:    log.snapshot.reduce((s, p) => s + (p.closingStock || 0), 0),
      productCount:  log.snapshot.length
    })).reverse();

    const productMap = {};
    logs.forEach(log => {
      log.snapshot.forEach(p => {
        if (!productMap[p.productName]) {
          productMap[p.productName] = {
            name:         p.productName,
            emoji:        p.emoji || '',
            category:     p.category,
            totalConsumed: 0,
            days:         [],
            avgConsumed:  0,
            isBio:        !!p.isBio,
            isLoose:      !!p.isLoose
          };
        }
        productMap[p.productName].totalConsumed += p.consumed || 0;
        productMap[p.productName].isBio   = productMap[p.productName].isBio   || !!p.isBio;
        productMap[p.productName].isLoose = productMap[p.productName].isLoose || !!p.isLoose;
        productMap[p.productName].days.push({
          date:         log.date,
          consumed:     p.consumed     || 0,
          closingStock: p.closingStock || 0
        });
      });
    });

    Object.values(productMap).forEach(p => {
      p.avgConsumed = parseFloat((p.totalConsumed / logs.length).toFixed(1));
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.totalConsumed - a.totalConsumed)
      .slice(0, 10);

    const categoryMap = {};
    Object.values(productMap).forEach(p => {
      categoryMap[p.category] = (categoryMap[p.category] || 0) + p.totalConsumed;
    });

    res.json({
      logs:        dailyTotals,
      topProducts,
      allProducts: Object.values(productMap),
      summary: {
        totalDays:         logs.length,
        totalConsumed:     logs.reduce((s, log) =>
          s + log.snapshot.reduce((ss, p) => ss + (p.consumed || 0), 0), 0),
        avgDailyConsumed:  parseFloat(
          (dailyTotals.reduce((s, d) => s + d.totalConsumed, 0) / dailyTotals.length).toFixed(1)
        ),
        categoryBreakdown: categoryMap
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/reports/telegram ───────────────────────────────────
router.post('/telegram', auth, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ category: 1 });
    const msg = buildTelegramText(products);  // FIX: helper تمیز استفاده می‌شود

    await sendTelegram(msg);

    // Log speichern
    const dateStr = new Date().toISOString().split('T')[0];
    await DailyLog.findOneAndUpdate(
      { date: dateStr },
      { date: dateStr, ...buildSnapshot(products, req.user._id), reportSent: true },
      { upsert: true, new: true }
    );

    res.json({ message: '✅ Bericht erfolgreich gesendet' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/reports/new-day ────────────────────────────────────
// این endpoint: ۱) snapshot ذخیره می‌کند  ۲) yesterdayStock را آپدیت می‌کند
// FIX: snapshot جداگانه (/api/products/snapshot) حذف شد — همه‌چیز اینجاست
router.post('/new-day', auth, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    const dateStr  = new Date().toISOString().split('T')[0];

    // ۱. Log ذخیره کن
    await DailyLog.findOneAndUpdate(
      { date: dateStr },
      { date: dateStr, ...buildSnapshot(products, req.user._id) },
      { upsert: true, new: true }
    );

    // ۲. yesterdayStock برابر currentStock امروز بشود
    await Promise.all(products.map(p =>
      Product.findByIdAndUpdate(p._id, {
        yesterdayStock: p.currentStock,
        updatedAt:      new Date(),
        updatedBy:      req.user._id
      })
    ));

    res.json({ message: '✅ Neuer Tag gestartet', count: products.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/reports/order-suggestions ──────────────────────────
router.get('/order-suggestions', auth, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    const logs     = await DailyLog.find().sort({ date: -1 }).limit(7);

    const avgMap = {};
    if (logs.length > 0) {
      const productMap = {};
      logs.forEach(log => {
        log.snapshot.forEach(p => {
          if (!productMap[p.productName]) productMap[p.productName] = [];
          productMap[p.productName].push(p.consumed || 0);
        });
      });
      Object.entries(productMap).forEach(([name, values]) => {
        avgMap[name] = parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
      });
    }

    const suggestions = products
      .filter(p => (p.currentStock ?? 0) <= p.minStock)
      .map(p => ({
        _id:              p._id,
        emoji:            p.emoji,
        name:             p.name,
        category:         p.category,
        currentStock:     p.currentStock  ?? 0,
        minStock:         p.minStock      ?? 5,
        avgDailyConsumed: avgMap[p.name]  || 0,
        suggestedOrder:   Math.max(
          (p.minStock ?? 5) * 2 - (p.currentStock ?? 0),
          Math.ceil((avgMap[p.name] || 0) * 3)
        ),
        status: (p.currentStock ?? 0) <= 0 ? 'kritisch' : 'niedrig',
        unit:   p.unit  || 'Kiste',
        isBio:  p.isBio,
        isLoose: p.isLoose
      }))
      .sort((a, b) => a.currentStock - b.currentStock);

    res.json({
      suggestions,
      meta: {
        totalItems:      suggestions.length,
        totalSuggested:  suggestions.reduce((s, p) => s + p.suggestedOrder, 0),
        basedOnDays:     logs.length,
        generatedAt:     new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/reports/telegram-order ────────────────────────────
router.post('/telegram-order', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Keine Nachricht angegeben' });
    await sendTelegram(message);
    res.json({ message: '✅ Bestellliste gesendet' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/reports/history?limit=30 ───────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 365);
    const logs  = await DailyLog.find().sort({ date: -1 }).limit(limit);

    const result = logs.map(log => ({
      _id:          log._id,
      date:         new Date(log.date).toISOString().split('T')[0],
      totalStock:   log.snapshot.reduce((s, p) => s + (p.closingStock || 0), 0),
      totalConsumed: log.snapshot.reduce((s, p) => s + (p.consumed    || 0), 0),
      productCount: log.snapshot.length,
      kritisch:     log.snapshot.filter(p => (p.closingStock || 0) <= 0).length,
      niedrig:      log.snapshot.filter(p => {
        const s = p.closingStock || 0;
        return s > 0 && s <= (p.minStock || 5);
      }).length,
      categories:   [...new Set(log.snapshot.map(p => p.category).filter(Boolean))],
      snapshot:     log.snapshot,
      reportSent:   log.reportSent || false
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/reports/reset-stock ───────────────────────────────
router.post('/reset-stock', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ message: 'Nur Admins dürfen Bestände zurücksetzen' });

    const { includeYesterday = false } = req.body || {};
    const products = await Product.find({ isActive: true });

    await Promise.all(products.map(p => Product.findByIdAndUpdate(p._id, {
      currentStock: 0,
      ...(includeYesterday ? { yesterdayStock: 0 } : {}),
      updatedAt:  new Date(),
      updatedBy:  req.user._id
    })));

    res.json({
      message:          '✅ Bestände zurückgesetzt',
      count:            products.length,
      yesterdayCleared: !!includeYesterday
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/reports/reset-logs ────────────────────────────────
// FIX: reset-weekly و reset-monthly حذف شدند — این endpoint همه حالت‌ها را پوشش می‌دهد
router.post('/reset-logs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ message: 'Nur Admins dürfen Logs löschen' });

    const scope   = (req.body?.scope || req.query?.scope || 'daily').toLowerCase();
    const todayStr = new Date().toISOString().split('T')[0];
    let filter    = {};

    if (scope === 'daily') {
      const date = req.body?.date || req.query?.date || todayStr;
      filter = { date };
    } else if (scope === 'weekly') {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      filter = { date: { $gte: since.toISOString().split('T')[0] } };
    } else if (scope === 'monthly') {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      filter = { date: { $gte: since.toISOString().split('T')[0] } };
    } else if (scope === 'all') {
      filter = {};
    } else {
      return res.status(400).json({ message: `Ungültiger scope: ${scope}. Erlaubt: daily, weekly, monthly, all` });
    }

    const deleted = await DailyLog.deleteMany(filter);
    res.json({
      message:      '✅ Logs zurückgesetzt',
      scope,
      deletedCount: deleted.deletedCount || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/reports/export?type=excel&date=2026-05-24 ──────────
router.get('/export', auth, async (req, res) => {
  try {
    const { type, date } = req.query;
    let logs;

    if (date) {
      logs = await DailyLog.find({ date }).sort({ date: -1 });
    } else {
      logs = await DailyLog.find().sort({ date: -1 }).limit(30);
    }

    if (logs.length === 0)
      return res.status(404).json({ message: 'Keine Daten gefunden' });

    if (type === 'excel') {
      const workbook   = new ExcelJS.Workbook();
      workbook.creator = 'EDEKA Lager';
      workbook.created = new Date();

      logs.forEach(log => {
        const sheetName = String(log.date).replace(/[:\\\/\?\*\[\]]/g, '-').slice(0, 31);
        const sheet = workbook.addWorksheet(sheetName);
        sheet.columns = [
          { header: 'Emoji',         key: 'emoji',    width: 8  },
          { header: 'Produkt',       key: 'name',     width: 22 },
          { header: 'Kategorie',     key: 'category', width: 16 },
          { header: 'Anfangsbestand', key: 'opening', width: 16 },
          { header: 'Endbestand',    key: 'closing',  width: 12 },
          { header: 'Verbrauch',     key: 'consumed', width: 12 },
          { header: 'Einheit',       key: 'unit',     width: 10 },
        ];

        // Header-Styling
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: 'FF1A1A1A' }  // EDEKA Dunkel
        };

        log.snapshot.forEach(p => {
          const row = sheet.addRow({
            emoji:    p.emoji        || '',
            name:     p.productName,
            category: p.category,
            opening:  p.openingStock || 0,
            closing:  p.closingStock || 0,
            consumed: p.consumed     || 0,
            unit:     p.unit         || 'Kiste'
          });
          if ((p.closingStock || 0) <= 0) {
            row.getCell('closing').font = { color: { argb: 'FFCC0000' }, bold: true };
          }
        });
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=EDEKA_Lager_${date || 'export'}.xlsx`
      );
      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({ message: 'type=excel erforderlich' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
