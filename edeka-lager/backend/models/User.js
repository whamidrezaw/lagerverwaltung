const mongoose = require('mongoose');

const loginEntrySchema = new mongoose.Schema({
  timestamp: { type: Date,   default: Date.now },
  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
  action:    { type: String, enum: ['login', 'logout'], default: 'login' }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String, required: true, unique: true,
    trim: true, lowercase: true
  },
  password:       { type: String, required: true },
  name:           { type: String, required: true, trim: true },
  role: {
    type: String,
    enum: ['admin', 'lagerist'],
    default: 'lagerist',
    index: true
  },
  telegramChatId: { type: String, default: null },
  isActive:       { type: Boolean, default: true, index: true },
  lastLogin:      { type: Date,    default: null },
  loginHistory:   { type: [loginEntrySchema], default: [] }
}, {
  timestamps: true   // createdAt + updatedAt خودکار
});

/**
 * FIX #4: addLoginEntry واقعاً در auth.js route استفاده می‌شود.
 * این متد را در auth.js به جای findByIdAndUpdate مستقیم صدا بزنید:
 *
 *   const user = await User.findById(...);
 *   user.addLoginEntry({ ip, userAgent, action: 'login' });
 *   await user.save();
 */
userSchema.methods.addLoginEntry = function(entry) {
  this.loginHistory = [
    { timestamp: new Date(), ...entry },
    ...this.loginHistory
  ].slice(0, 50);
  this.lastLogin = new Date();
  return this;   // برای chaining
};

module.exports = mongoose.model('User', userSchema);
