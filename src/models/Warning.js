const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, default: 'No reason provided' },
  caseNumber: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

warningSchema.index({ guildId: 1, userId: 1 });
warningSchema.index({ guildId: 1, caseNumber: 1 });

module.exports = mongoose.model('Warning', warningSchema);
