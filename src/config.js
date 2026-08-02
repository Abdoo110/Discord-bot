require('dotenv').config();

module.exports = {
  // ─── Bot ──────────────────────────────────
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  mongoUri: process.env.MONGODB_URI,
  botInvite: process.env.BOT_INVITE,

  // ─── Colors (for embeds) ─────────────────
  colors: {
    success: 0x2ECC71,
    error: 0xE74C3C,
    warn: 0xF39C12,
    info: 0x3498DB,
    giveaway: 0x9B59B6,
    partner: 0x1ABC9C,
    vouch: 0x2ECC71,
    scam: 0xE74C3C,
    mod: 0xE67E22,
    staff: 0x9B59B6,
    fun: 0xF1C40F,
    default: 0x5865F2, // Discord blurple
  },

  // ─── Anti‑Abuse defaults ─────────────────
  antiSpam: {
    enabled: true,
    maxMessages: 5,          // messages allowed in window
    windowMs: 3000,          // time window (3 seconds)
    muteDuration: 60000,     // 1 minute mute
    ignoredRoles: [],        // role IDs to ignore
  },
  antiRaid: {
    enabled: true,
    maxJoins: 10,            // max users joining in window
    windowMs: 10000,         // 10 second window
    action: 'lockdown',      // 'lockdown' or 'kick'
  },
  antiNuke: {
    enabled: true,
    maxChannelDeletes: 3,     // per 10s window
    maxRoleDeletes: 3,
    maxBanKicks: 5,
    windowMs: 10000,
  },
};
