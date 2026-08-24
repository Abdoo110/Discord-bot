const GuildConfig = require('../models/GuildConfig');
const config = require('../config');
const { buildEmbed } = require('../utils/embed');

// ─── In-memory rate limit caches ────────────────────────────────
// spamCache:  Map<guildId, Map<userId, { count, firstMsgTime }>>
// raidCache:  Map<guildId, { count, windowStart, alerted, bots:Set }>
// nukeCache:  Map<guildId, { channelDeletes, roleDeletes, banKicks, windowStart, alerted }>
const spamCache = new Map();
const raidCache = new Map();
const nukeCache = new Map();

// Periodic cleanup to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [gid, gmap] of spamCache) {
    for (const [uid, d] of gmap) if (now - d.firstMsgTime > 120000) gmap.delete(uid);
    if (gmap.size === 0) spamCache.delete(gid);
  }
  for (const [gid, d] of raidCache) if (now - d.windowStart > 120000) raidCache.delete(gid);
  for (const [gid, d] of nukeCache) if (now - d.windowStart > 60000) nukeCache.delete(gid);
}, 60000).unref();

// ─── Language / character detection ─────────────────────────────
// Unicode ranges for non-Latin scripts commonly used in "weird"/foreign spam.
const BLOCKED_SCRIPT_RANGES = [
  /[\u0600-\u06FF]/u,   // Arabic
  /[\u0750-\u077F]/u,   // Arabic Supplement
  /[\u0400-\u04FF]/u,   // Cyrillic
  /[\uAC00-\uD7AF]/u,   // Hangul (Korean)
  /[\u3040-\u30FF]/u,   // Hiragana + Katakana (Japanese)
  /[\u4E00-\u9FFF]/u,   // CJK Unified Ideographs (Chinese)
  /[\u3400-\u4DBF]/u,   // CJK Extension A
  /[\u0E00-\u0E7F]/u,   // Thai
  /[\u0900-\u097F]/u,   // Devanagari (Hindi etc.)
  /[\u0980-\u09FF]/u,   // Bengali
  /[\u05D0-\u05EA]/u,   // Hebrew
  /[\u1E00-\u1EFF]/u,   // Latin Extended Additional (Vietnamese)
];

// Detect if a string contains characters from a blocked/non-Latin script.
function detectBlockedScript(text) {
  if (!text) return null;
  for (const re of BLOCKED_SCRIPT_RANGES) {
    if (re.test(text)) return re.toString();
  }
  return null;
}

// Detect "weird" characters: anything outside the standard Latin/ASCII printable
// set that isn't a common emoji. Returns true if weird chars found.
function hasWeirdChars(text) {
  if (!text) return false;
  // Strip emoji and common symbols first so normal use isn't flagged.
  const emojiStripped = text.replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu,
    ''
  );
  // Allowed: printable ASCII + common typographic punctuation so legit English
  // text using smart quotes/dashes isn't false-flagged.
  const allowed = emojiStripped.replace(
    /[\x20-\x7E\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u2022\u00B0\u00A9\u00AE\u2122\u00C7\u00E7\u00F1\u00D1\u00E9\u00E8\u00EA\u00EB\u00E0\u00E2]/g,
    ''
  );
  const leftover = allowed.replace(/\s/g, '');
  return leftover.length > 0;
}

// ─── Helpers ────────────────────────────────────────────────────
function getGuildMap(cache, guildId) {
  if (!cache.has(guildId)) cache.set(guildId, new Map());
  return cache.get(guildId);
}

// Post an alert to staff (modLogs channel). This is alert-only — we never
// lock the server or silence members automatically.
async function alertStaff(guild, title, description, color = 'warn') {
  try {
    const cfg = await GuildConfig.findOne({ guildId: guild.id });
    if (!cfg) return;
    const chId = cfg.channels?.modLogs || cfg.channels?.staffLogs;
    if (!chId) return;
    const logChannel = guild.channels.cache.get(chId);
    if (!logChannel) return;
    await logChannel.send({ embeds: [buildEmbed({ color, title, description, timestamp: Date.now() })] }).catch(() => {});
  } catch (_) {}
}

// Manual lockdown (ONLY used when staff explicitly run /antiraid lockdown).
async function lockdown(guild) {
  for (const [, channel] of guild.channels.cache) {
    if (channel.isTextBased()) {
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {});
    }
  }
}

async function unlock(guild) {
  for (const [, channel] of guild.channels.cache) {
    if (channel.isTextBased()) {
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }).catch(() => {});
    }
  }
}

function isSuspicious(entry, minAccountAgeMs = 86400000) {
  // A "suspicious" account = brand new, or obviously a bot. These are the only
  // ones we take automatic action against. Humans are never removed.
  const created = entry?.user?.createdTimestamp || 0;
  const isNew = created && (Date.now() - created < minAccountAgeMs);
  const isBot = entry?.user?.bot === true;
  return isBot || isNew;
}

// ─── Anti-Spam ─────────────────────────────────────────────────
async function checkSpam(message) {
  if (!message.guild || message.author.bot) return false;
  const cfg = await GuildConfig.findOne({ guildId: message.guild.id });
  if (!cfg || !cfg.antiSpamEnabled) return false;

  const { maxMessages = 5, windowMs = 3000, timeoutDurationMs = 600000 } = config.antiSpam;
  const gmap = getGuildMap(spamCache, message.guild.id);
  const now = Date.now();
  const content = message.content || '';

  // 1) Blocked-script / weird-language detection (immediate timeout).
  const blockedScript = detectBlockedScript(content);
  const weird = hasWeirdChars(content);
  if (blockedScript || weird) {
    const label = blockedScript ? blockedScript : 'non-Latin characters';
    await punishForLanguage(message, label);
    return true;
  }

  // 2) Rate-limit spam detection.
  if (!gmap.has(message.author.id)) {
    gmap.set(message.author.id, { count: 1, firstMsgTime: now });
    return false;
  }
  const data = gmap.get(message.author.id);
  if (now - data.firstMsgTime > windowMs) {
    data.count = 1;
    data.firstMsgTime = now;
    return false;
  }
  data.count++;
  if (data.count > maxMessages) {
    await punishForSpam(message, timeoutDurationMs);
    gmap.delete(message.author.id);
    return true;
  }
  return false;
}

async function punishForSpam(message, durationMs) {
  const member = message.member;
  try {
    if (member && member.moderatable) await member.timeout(durationMs, 'Anti-spam: message flood');
  } catch (_) {}
  try {
    const msgs = await message.channel.messages.fetch({ limit: 20 });
    const cutoff = Date.now() - 10000;
    const userMsgs = msgs.filter(m => m.author.id === message.author.id && m.createdTimestamp > cutoff);
    if (userMsgs.size > 0) await message.channel.bulkDelete(userMsgs).catch(async () => {
      for (const m of userMsgs.values()) await m.delete().catch(() => {});
    });
  } catch (_) {}
  await alertStaff(message.guild, '🚫 Anti-Spam', `**${message.author.tag}** (\`${message.author.id}\`) timed out for **10 minutes** for message flooding.`, 'error');
}

async function punishForLanguage(message, label) {
  try { await message.delete().catch(() => {}); } catch (_) {}
  const member = message.member;
  try {
    if (member && member.moderatable) await member.timeout(600000, 'Anti-spam: blocked language / non-Latin characters');
  } catch (_) {}
  await alertStaff(message.guild, '🌐 Language Blocked', `**${message.author.tag}** (\`${message.author.id}\`) was timed out for **10 minutes** for sending blocked (non-English) content.\nDetected: ${label}`, 'warn');
}

// ─── Anti-Raid ─────────────────────────────────────────────────
// IMPORTANT: This NEVER locks channels and NEVER removes human members.
// It only (a) kicks/ignores obvious bot accounts and (b) alerts staff when a
// suspicious join burst is detected. Members can keep joining and talking.
async function checkRaid(member) {
  const cfg = await GuildConfig.findOne({ guildId: member.guild.id });
  if (!cfg || !cfg.antiRaidEnabled) return;

  const { maxJoins = 10, windowMs = 10000, minAccountAgeMs = 86400000 } = config.antiRaid;
  const now = Date.now();
  let data = raidCache.get(member.guild.id);

  if (!data) {
    raidCache.set(member.guild.id, { count: 1, windowStart: now, alerted: false, bots: new Set() });
    return;
  }

  // Reset window if expired.
  if (now - data.windowStart > windowMs) {
    data.count = 1;
    data.windowStart = now;
    data.alerted = false;
    data.bots = new Set();
    return;
  }

  data.count++;

  // Only act against obvious bot accounts. Humans are NEVER touched here.
  if (member.user?.bot) {
    data.bots.add(member.id);
    const m = member.guild.members.cache.get(member.id) || member;
    if (m.kickable) await m.kick('Anti-raid: bot account detected').catch(() => {});
  }

  // If a suspicious burst happened, just ALERT staff (no lockdown, no kicks of humans).
  if (data.count >= maxJoins && !data.alerted) {
    data.alerted = true;
    console.log(`[ANTI-RAID] Join burst detected in ${member.guild.name} (${data.count} joins / ${windowMs / 1000}s)`);
    await alertStaff(
      member.guild,
      '⚠️ Possible Raid Warning',
      `**${data.count}** members joined in **${windowMs / 1000}s**. No members were removed or silenced.\n` +
      `Bot accounts kicked: ${data.bots.size}.\n\n` +
      `Members can still join, chat and react as normal. Please review the join logs and decide if manual action is needed.`,
      'warn'
    );
  }
}

// ─── Anti-Nuke ─────────────────────────────────────────────────
// IMPORTANT: This NEVER locks the server. It detects destructive bursts
// (mass channel/role deletes, mass bans) and ONLY alerts staff. If the actor
// is a bot, that bot is timed out. Humans are never touched automatically.
function getNukeCache(guildId) {
  if (!nukeCache.has(guildId)) {
    nukeCache.set(guildId, { channelDeletes: 0, roleDeletes: 0, banKicks: 0, windowStart: Date.now(), alerted: false });
  }
  return nukeCache.get(guildId);
}

async function checkAntiNuke(guild, type) {
  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  if (!cfg || !cfg.antiNukeEnabled) return false;

  const { maxChannelDeletes = 3, maxRoleDeletes = 3, maxBanKicks = 5, windowMs = 10000 } = config.antiNuke;

  const data = getNukeCache(guild.id);
  const now = Date.now();

  if (now - data.windowStart > windowMs) {
    data.channelDeletes = 0;
    data.roleDeletes = 0;
    data.banKicks = 0;
    data.windowStart = now;
    data.alerted = false;
  }

  data[type]++;

  const limits = { channelDeletes: maxChannelDeletes, roleDeletes: maxRoleDeletes, banKicks: maxBanKicks };
  const typeLabel = { channelDeletes: 'channel deletions', roleDeletes: 'role deletions', banKicks: 'ban/kick actions' };

  if (data[type] >= limits[type] && !data.alerted) {
    data.alerted = true;
    console.log(`[ANTI-NUKE] Nuke burst detected in ${guild.name}! Type: ${type}`);

    // Only punish bots. Humans are left for staff to review.
    const offender = await findOffender(guild, type);
    let acted = false;
    if (offender && offender.user?.bot && offender.moderatable) {
      await offender.timeout(600000, `Anti-nuke: ${type}`).catch(() => {});
      acted = true;
    }

    const actorLabel = offender ? `**${offender.user.tag}** (\`${offender.id}\`)` : 'Unknown actor';
    await alertStaff(
      guild,
      '🚨 Possible Nuke Warning',
      `Detected **${data[type]}** ${typeLabel[type]} in **${windowMs / 1000}s**.\n` +
      `Actor: ${actorLabel}\n\n` +
      `No channels were locked and no human members were affected.` +
      (acted ? ` The bot actor was timed out.` : ` Please review the audit log and take manual action if needed.`),
      'error'
    );

    return true;
  }
  return false;
}

// Discover the actor responsible for a destructive action via the audit log.
async function findOffender(guild, type) {
  try {
    const { AuditLogEvent } = require('discord.js');
    const eventMap = {
      channelDeletes: AuditLogEvent.ChannelDelete,
      roleDeletes: AuditLogEvent.RoleDelete,
      banKicks: AuditLogEvent.MemberBanAdd,
    };
    const entries = await guild.fetchAuditLogs({ type: eventMap[type], limit: 5 }).catch(() => null);
    if (!entries) return null;
    const entry = entries.entries.find(e => Date.now() - e.createdTimestamp < 15000);
    if (!entry || !entry.executor) return null;
    const member = await guild.members.fetch(entry.executor.id).catch(() => null);
    return member || null;
  } catch (_) {
    return null;
  }
}

// ─── Manual lock / unlock (used only by explicit /antiraid command) ──
async function manualLockdown(guild, mod) {
  await lockdown(guild);
  await alertStaff(guild, '🔒 Manual Lockdown', `All channels locked by ${mod ? mod.user.tag : 'staff'} (manual command).`, 'warn');
}

async function manualUnlock(guild, mod) {
  await unlock(guild);
  await alertStaff(guild, '🔓 Channels Unlocked', `All channels unlocked by ${mod ? mod.user.tag : 'staff'} (manual command).`, 'success');
}

module.exports = {
  checkSpam,
  checkRaid,
  checkAntiNuke,
  detectBlockedScript,
  hasWeirdChars,
  isSuspicious,
  manualLockdown,
  manualUnlock,
  lockdown,
  unlock,
};
