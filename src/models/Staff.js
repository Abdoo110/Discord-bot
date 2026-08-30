const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  ign: { type: String, default: null },
  timezone: { type: String, default: null },
  position: { type: String, default: 'Staff' },
  hiredAt: { type: Date, default: Date.now },
  loa: {
    active: { type: Boolean, default: false },
    reason: { type: String, default: null },
    startedAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
});

staffSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Staff', staffSchema);
