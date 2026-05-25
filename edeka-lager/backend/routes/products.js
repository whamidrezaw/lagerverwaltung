const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Product = require('../models/Product');

// GET /api/products  — همه محصولات فعال
router.get('/', auth, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.isBio   === 'true') filter.isBio   = true;
    if (req.query.isLoose === 'true') filter.isLoose = true;

    const products = await Product.find(filter).sort({ category: 1, name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products  — محصول جدید
router.post('/', auth, async (req, res) => {
  try {
    const {
      emoji, name, category, currentStock, yesterdayStock,
      minStock, unit, isBio, isLoose
    } = req.body;

    if (!name) return res.status(400).json({ message: 'Produktname erforderlich' });

    const product = await Product.create({
      emoji:          emoji         || '📦',
      name,
      category:       category      || 'Sonstige',
      currentStock:   currentStock  ?? 0,
      yesterdayStock: yesterdayStock ?? currentStock ?? 0,
      minStock:       minStock      ?? 5,
      unit:           unit          || 'Kiste',
      isBio:          !!isBio,
      isLoose:        !!isLoose,
      isActive:       true,
      updatedBy:      req.user._id
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/products/:id  — ویرایش مشخصات (نه موجودی)
router.put('/:id', auth, async (req, res) => {
  try {
    const allowed = ['name', 'emoji', 'minStock', 'unit', 'category', 'isLoose', 'isBio'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updatedAt = new Date();
    updates.updatedBy = req.user._id;

    // FIX: Mongoose 9 → { new: true } به جای returnDocument: 'after'
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Produkt nicht gefunden' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/products/:id/stock  — به‌روزرسانی موجودی
router.patch('/:id/stock', auth, async (req, res) => {
  try {
    const { currentStock } = req.body;

    if (currentStock === undefined || currentStock < 0)
      return res.status(400).json({ message: 'Ungültiger Bestandswert' });

    // FIX: Mongoose 9 → { new: true }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        currentStock,
        updatedAt: new Date(),
        updatedBy: req.user._id
      },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Produkt nicht gefunden' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/products/:id  — غیرفعال‌کردن محصول (soft delete)
// برای حذف کامل از ?permanent=true استفاده کنید (فقط admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const permanent = String(req.query.permanent || '').toLowerCase() === 'true';

    if (permanent) {
      if (req.user.role !== 'admin')
        return res.status(403).json({ message: 'Nur Admins dürfen Produkte endgültig löschen' });

      const deleted = await Product.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Produkt nicht gefunden' });
      return res.json({ message: '🗑️ Produkt endgültig gelöscht' });
    }

    // Soft delete
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: new Date(), updatedBy: req.user._id },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Produkt nicht gefunden' });
    res.json({ message: 'Produkt deaktiviert' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
