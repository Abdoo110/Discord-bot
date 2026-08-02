const GuildConfig = require('../models/GuildConfig');
const config = require('../config');
const { getMuteRole } = require('./guildConfig');

// Spam tracking: Map<guildId, Map<userId, { count, firstMsgTime }>>
const spamCache = new Map();
// Raid tracking: Map<guildId, { count, windowStart }>
const raidCache = new Map();
// Nuke tracking: Map<guildId, { channelDeletes, roleDeletes, banKicks, windowStart }>
const nukeCache = new Map();

async function checkSpam(message) {
  if (!message.guild || message.author.bot) return false;

  const cfg = await GuildConfig.findOne({ guildId: message.guild.id });
  if (!cfg || !cfg.antiSpamEnabled) return false;

  if (cfg.roles.mutedRole && message.member?.roles.cache.has(cfg.roles.mutedRole)) return false;

  const { maxMessages = 5, windowMs = 3000, muteDuration = 60000 } = config.antiSpam;

  if (!spamCache.has(message.guild.id)) spamCache.set(message.guild.id, new Map());
  const guildSpam = spamCache.get(message.guild.id);

  const now = Date.now();
  if (!guildSpam.has(message.author.id)) {
    guildSpam.set(message.author.id, { count: 1, firstMsgTime: now });
    return false;
  }

  const data = guildSpam.get(message.author.id);

  if (now - data.firstMsgTime > windowMs) {
    data.count = 1;
    data.firstMsgTime = now;
    return false;
  }

  data.count++;

  if (data.count > maxMessages) {
    try {
      const muteRole = await getMuteRole(message.guild);
      if (muteRole && message.member) {
        await message.member.roles.add(muteRole, 'Anti-spam: too many messages');
        setTimeout(async () => {
          try {
            if (message.member) await message.member.roles.remove(muteRole, 'Auto-unmute: spam timeout expired');
          } catch (_) {}
        }, muteDuration);
      }
    } catch (_) {}

    try {
      const msgs = await message.channel.messages.fetch({ limit: 10 });
      const userMsgs = msgs.filter(m => m.author.id === message.author.id && (now - m.createdTimestamp < windowMs * 2));
      if (userMsgs.size > 0) await message.channel.bulkDelete(userMsgs);
    } catch (_) {}

    guildSpam.delete(message.author.id);
    return true;
  }

  return false;
}

async function checkRaid(member) {
  const cfg = await GuildConfig.findOne({ guildId: member.guild.id });
  if (!cfg || !cfg.antiRaidEnabled) return;

  const { maxJoins = 10, windowMs = 10000, action = 'lockdown' } = config.antiRaid;

  if (!raidCache.has(member.guild.id)) {
    raidCache.set(member.guild.id, { count: 1, windowStart: Date.now() });
    return;
  }

  const data = raidCache.get(member.guild.id);
  const now = Date.now();

  if (now - data.windowStart > windowMs) {
    data.count = 1;
    data.windowStart = now;
    return;
  }

  data.count++;

  if (data.count >= maxJoins) {
    console.log(`[ANTI-RAID] Raid detected in ${member.guild.name}! Action: ${action}`);

    if (action === 'lockdown') {
      for (const [, channel] of member.guild.channels.cache) {
        if (channel.isTextBased() && channel.permissionsFor(member.guild.roles.everyone).has('SendMessages')) {
          await channel.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false }).catch(() => {});
        }
      }

      const logChannelId = cfg.channels.modLogs;
      if (logChannelId) {
        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const { buildEmbed } = require('./embed');
          logChannel.send({ embeds: [buildEmbed({ color: 'error', title: '🚨 ANTI-RAID ACTIVATED',
            description: `Raid detected! Too many users joining quickly. All channels have been **locked down**.\n\n**Joins:** ${data.count}\n**Window:** ${windowMs / 1000}s`,
            timestamp: Date.now() })] });
        }
      }
    }

    raidCache.delete(member.guild.id);
  }
}

function getNukeCache(guildId) {
  if (!nukeCache.has(guildId)) {
    nukeCache.set(guildId, { channelDeletes: 0, roleDeletes: 0, banKicks: 0, windowStart: Date.now(), locked: false });
  }
  return nukeCache.get(guildId);
}

async function checkAntiNuke(guild, type) {
  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  if (!cfg || !cfg.antiNukeEnabled) return false;

  const data = getNukeCache(guild.id);
  const now = Date.now();
  const { maxChannelDeletes = 3, maxRoleDeletes = 3, maxBanKicks = 5, windowMs = 10000 } = config.antiNuke;

  if (now - data.windowStart > windowMs) {
    data.channelDeletes = 0;
    data.roleDeletes = 0;
    data.banKicks = 0;
    data.windowStart = now;
    data.locked = false;
  }

  data[type]++;

  const limits = { channelDeletes: maxChannelDeletes, roleDeletes: maxRoleDeletes, banKicks: maxBanKicks };
  if (data[type] >= limits[type] && !data.locked) {
    data.locked = true;
    console.log(`[ANTI-NUKE] Nuke detected in ${guild.name}! Type: ${type}`);

    for (const [, channel] of guild.channels.cache) {
      if (channel.isTextBased()) {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {});
      }
    }

    const logChannelId = cfg.channels.modLogs;
    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const { buildEmbed } = require('./embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'error', title: '🚨 ANTI-NUKE ACTIVATED',
          description: `Nuke attempt detected! All channels have been **locked down**.\n\n**Type:** ${type}\n**Count:** ${data[type]}`,
          timestamp: Date.now() })] });
      }
    }
    return true;
  }

  return false;
}

module.exports = { checkSpam, checkRaid, checkAntiNuke };
