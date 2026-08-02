const mongoose = require('mongoose');

const vouchSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  targetId: { type: String, required: true },
  authorId: { type: String, required: true },
  type: { type: String, enum: ['vouch', 'scam'], required: true },
  reason: { type: String, default: 'No reason provided' },
  createdAt: { type: Date, default: Date.now },
});

vouchSchema.index({ guildId: 1, targetId: 1 });
vouchSchema.index({ guildId: 1, targetId: 1, type: 1 });

module.exports = mongoose.model('Vouch', vouchSchema);
