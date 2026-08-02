const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  partnerCount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

partnerSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Partner', partnerSchema);
