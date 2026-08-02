const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  hostId: { type: String, required: true },
  prize: { type: String, required: true },
  winners: { type: Number, default: 1 },
  durationMs: { type: Number, required: true },
  endsAt: { type: Date, required: true },
  ended: { type: Boolean, default: false },
  winnerIds: [{ type: String }],
  rerolled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

giveawaySchema.index({ guildId: 1, ended: 1 });
giveawaySchema.index({ guildId: 1, hostId: 1 });

module.exports = mongoose.model('Giveaway', giveawaySchema);
