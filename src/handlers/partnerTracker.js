const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');

/**
 * Check if a message contains a Discord invite link.
 * Matches: discord.gg/CODE, discord.com/invite/CODE, discordapp.com/invite/CODE
 */
function hasInviteLink(content) {
  const inviteRegex = /(?:discord\.(?:gg|com|app\.com)\/(?:invite\/)?)([a-zA-Z0-9\-_]+)/gi;
  return inviteRegex.test(content);
}

/**
 * Track partner messages in the configured partner channel.
 * Only counts messages that contain a Discord invite link.
 */
async function handleMessage(message) {
  if (!message.guild || message.author.bot) return;

  const cfg = await GuildConfig.findOne({ guildId: message.guild.id });
  const partnerChannelId = cfg?.channels?.partnerChannel;
  if (!partnerChannelId) return;

  if (message.channel.id !== partnerChannelId) return;
  if (!hasInviteLink(message.content)) return;

  try {
    await Partner.findOneAndUpdate(
      { guildId: message.guild.id, userId: message.author.id },
      {
        $inc: { partnerCount: 1 },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true },
    );
    console.log(`[PARTNER] +1 for ${message.author.tag} in ${message.guild.name}`);
  } catch (err) {
    console.error('[PARTNER] DB Error:', err.message);
  }
}

module.exports = { handleMessage, hasInviteLink };
