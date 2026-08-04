const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  hostId: { type: String, required: true },
  hostName: { type: String, default: '' },
  prize: { type: String, required: true },
  prizeValue: { type: Number, default: 0 },
  winners: { type: Number, default: 1 },
  durationMs: { type: Number, required: true },
  endsAt: { type: Date, required: true },
  ended: { type: Boolean, default: false },
  claimTimeMs: { type: Number, default: 0 },
  entrants: { type: [{ type: String }], default: [] },
  winnerIds: [{ type: String }],
  claimedBy: [{ type: String }],
  claimIGNs: { type: Map, of: String, default: {} },
  claimMessageId: { type: String, default: '' },
  rerolled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

giveawaySchema.index({ guildId: 1, ended: 1 });
giveawaySchema.index({ guildId: 1, hostId: 1 });
giveawaySchema.index({ guildId: 1, createdAt: 1 });

module.exports = mongoose.model('Giveaway', giveawaySchema);
