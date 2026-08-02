const GuildConfig = require('../models/GuildConfig');

async function getConfig(guildId) {
  let cfg = await GuildConfig.findOne({ guildId });
  if (!cfg) {
    cfg = await GuildConfig.create({ guildId });
  }
  return cfg;
}

async function setChannel(guildId, key, channelId) {
  const cfg = await getConfig(guildId);
  cfg.channels[key] = channelId;
  await cfg.save();
  return cfg;
}

async function setRole(guildId, key, roleId) {
  const cfg = await getConfig(guildId);
  cfg.roles[key] = roleId;
  await cfg.save();
  return cfg;
}

async function getMuteRole(guild) {
  const cfg = await getConfig(guild.id);
  let role;

  if (cfg.roles.mutedRole) {
    role = guild.roles.cache.get(cfg.roles.mutedRole);
    if (role) return role;
  }

  try {
    role = await guild.roles.create({
      name: 'Muted',
      color: '#818386',
      reason: 'Mute role for moderation',
      permissions: [],
    });

    for (const [, channel] of guild.channels.cache) {
      if (channel.isTextBased()) {
        await channel.permissionOverwrites.create(role, {
          SendMessages: false,
          AddReactions: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
          Speak: false,
        }).catch(() => {});
      }
    }

    cfg.roles.mutedRole = role.id;
    await cfg.save();
  } catch (err) {
    console.error('Failed to create mute role:', err.message);
    return null;
  }

  return role;
}

module.exports = { getConfig, setChannel, setRole, getMuteRole };
