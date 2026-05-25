const mongoose = require('mongoose');

const snapshotItemSchema = new mongoose.Schema({
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName:  { type: String, required: true },
  emoji:        { type: String, default: '📦' },
  category:     { type: String, default: 'Sonstige' },
  openingStock: { type: Number, default: 0 },
  closingStock: { type: Number, default: 0 },
  consumed:     { type: Number, default: 0 },
  unit:         { type: String, default: 'Kiste' },
  // FIX #14: minStock بدون default — مقدار واقعی محصول ذخیره می‌شود
  minStock:     { type: Number },
  isLoose:      { type: Boolean, default: false },
  isBio:        { type: Boolean, default: false }
}, { _id: false });

const dailyLogSchema = new mongoose.Schema({
  // FIX #11: date را به عنوان String نگه می‌داریم (YYYY-MM-DD)
  // اما unique index اضافه می‌کنیم تا duplicate نشود.
  // String-sort برای فرمت ISO کار می‌کند ("2026-05-24" > "2026-05-01" ✅)
  date: {
    type:     String,
    required: true,
    unique:   true,   // FIX #13: یک log در روز — duplicate غیرممکن
    match:    /^\d{4}-\d{2}-\d{2}$/  // فرمت YYYY-MM-DD اجباری
  },
  snapshot:   { type: [snapshotItemSchema], default: [] },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportSent: { type: Boolean, default: false }
}, {
  // FIX #12: timestamps: true → createdAt و updatedAt خودکار
  // فیلد دستی createdAt حذف شد — تضادی وجود ندارد
  timestamps: true
});

// Index برای query سریع روی date (sort و range query)
dailyLogSchema.index({ date: -1 });

module.exports = mongoose.model('DailyLog', dailyLogSchema);
