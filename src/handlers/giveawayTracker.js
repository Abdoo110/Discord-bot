const Giveaway = require('../models/Giveaway');

/**
 * Detects giveaway messages from any bot and logs them.
 * No participant tracking — just counts giveaways per bot.
 */

const GIVEAWAY_KEYWORDS = ['giveaway', 'give away', '🎉'];

function isGiveawayEmbed(embed) {
  const title = (embed.title || '').toLowerCase();
  const desc = (embed.description || '').toLowerCase();
  return GIVEAWAY_KEYWORDS.some(kw => (title + ' ' + desc).includes(kw));
}

function extractPrize(embed) {
  if (embed.title) {
    const match = embed.title.match(/giveaway[:\s-]+(.+)/i);
    if (match) return match[1].trim();
    const before = embed.title.match(/(.+)\s+giveaway/i);
    if (before) return before[1].trim();
    return embed.title.replace(/🎉|giveaway/gi, '').trim() || 'Unknown Prize';
  }
  return 'Unknown Prize';
}

function extractEndsAt(embed) {
  const combined = ((embed.description || '') + ' ' + (embed.footer?.text || '')).toLowerCase();
  const ts = combined.match(/<t:(\d+):[RrFfDdTt]>/);
  if (ts) return new Date(parseInt(ts[1]) * 1000);
  const endsIn = combined.match(/ends?\s+in\s+(\d+)\s*(second|minute|hour|day|week)s?/i);
  if (endsIn) {
    const mult = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000 };
    return new Date(Date.now() + parseInt(endsIn[1]) * (mult[endsIn[2].toLowerCase()] || 60000));
  }
  return new Date(Date.now() + 3600000);
}

async function handleMessage(message) {
  if (!message.guild || !message.author.bot || !message.embeds?.length) return;

  for (const embed of message.embeds) {
    if (!isGiveawayEmbed(embed)) continue;

    try {
      await Giveaway.create({
        guildId: message.guild.id,
        messageId: message.id,
        channelId: message.channel.id,
        hostId: message.author.id,
        hostName: message.author.username,
        prize: extractPrize(embed),
        winners: 1,
        durationMs: 3600000,
        endsAt: extractEndsAt(embed),
        createdAt: new Date(),
      });
      console.log(`[TRACKER] Giveaway by ${message.author.username}: "${extractPrize(embed)}"`);
    } catch (err) {
      if (err.code !== 11000) console.error('[TRACKER] Error:', err.message);
    }
    return;
  }
}

module.exports = { handleMessage };
