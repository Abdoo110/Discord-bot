const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },

  channels: {
    modLogs: { type: String, default: null },
    messageLogs: { type: String, default: null },
    warningLogs: { type: String, default: null },
    vouchLogs: { type: String, default: null },
    staffLogs: { type: String, default: null },
    giveawayLogs: { type: String, default: null },
    partnerChannel: { type: String, default: null },
    ordersChannel: { type: String, default: null },
    orderPaidChannel: { type: String, default: null },
    claimIGNsChannel: { type: String, default: null },
    giveawayProofChannel: { type: String, default: null },
    bugReports: { type: String, default: null },
    activityChannel: { type: String, default: null },
    stickyChannel: { type: String, default: null },
  },

  roles: {
    staffRole: { type: String, default: null },
    adminRole: { type: String, default: null },
    moderatorRole: { type: String, default: null },
    mutedRole: { type: String, default: null },
    activityRole: { type: String, default: null },
  },

  antiSpamEnabled: { type: Boolean, default: true },
  antiRaidEnabled: { type: Boolean, default: true },
  antiNukeEnabled: { type: Boolean, default: true },

  // When a command has entries here, those roles (plus the owner) are its only users.
  commandRoles: { type: Map, of: [String], default: {} },

  prefix: { type: String, default: '!' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

guildConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('GuildConfig', guildConfigSchema);
