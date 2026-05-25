const mongoose = require('mongoose');

// FIX #9: 'Sonstige' به enum اضافه شد تا محصولات بدون category خاص
// validate شوند. 'Bio' حذف شده بود — درست است، isBio این کار را می‌کند.
const CATEGORIES = [
  'Obst', 'Gemüse', 'Zitrusfrüchte', 'Exotisch',
  'Beeren', 'Kräuter', 'Pilze', 'Sonstige'
];

const productSchema = new mongoose.Schema({
  emoji:          { type: String, default: '📦' },
  name:           { type: String, required: true, trim: true, unique: true },
  category: {
    type:     String,
    enum:     CATEGORIES,
    required: true,
    index:    true
  },
  unit:           { type: String, default: 'Kiste' },
  isLoose:        { type: Boolean, default: false },
  isBio:          { type: Boolean, default: false, index: true },
  currentStock:   { type: Number,  default: 0, min: 0 },
  yesterdayStock: { type: Number,  default: 0, min: 0 },
  minStock:       { type: Number,  default: 5, min: 0 },
  isActive:       { type: Boolean, default: true, index: true },
  updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  // FIX #6: timestamps: true → updatedAt خودکار مدیریت می‌شود.
  // در routes دیگر updates.updatedAt = new Date() لازم نیست (اما ضرری هم ندارد).
  timestamps: true,

  // FIX #10: هم toJSON و هم toObject virtuals را برمی‌گردانند
  toJSON:   { virtuals: true },
  toObject: { virtuals: true }
});

// FIX #7 و #8: virtual‌ها تعریف شده‌اند — در reports.js از p.status و p.consumed استفاده کنید
// به جای اینکه منطق را دوباره محاسبه کنید.
productSchema.virtual('status').get(function () {
  if (this.currentStock <= 0)                          return 'kritisch';
  if (this.currentStock <= this.minStock)              return 'niedrig';
  return 'ok';
});

productSchema.virtual('consumed').get(function () {
  return Math.max(0, (this.yesterdayStock ?? 0) - (this.currentStock ?? 0));
});

// Export: لیست categories برای استفاده در frontend و validation
productSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model('Product', productSchema);
