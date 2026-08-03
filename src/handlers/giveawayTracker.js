const Giveaway = require('../models/Giveaway');

/**
 * Detects giveaway embeds from any bot and extracts who HOSTED it.
 * Most giveaway bots put the host in the embed footer or description.
 */

const GIVEAWAY_PATTERNS = ['giveaway', 'give away', '🎉'];

function isGiveawayEmbed(embed) {
  const text = ((embed.title || '') + ' ' + (embed.description || '')).toLowerCase();
  return GIVEAWAY_PATTERNS.some(p => text.includes(p));
}

/**
 * Try to find the human who started the giveaway.
 * Giveaway bots typically put the host in:
 * - Footer text: "Requested by @User" / "Hosted by User"
 * - Description field: "Hosted by: @User"
 * If we find a mention <@ID>, return that ID.
 * Otherwise return the username string.
 */
function extractHost(embed) {
  const desc = embed.description || '';
  const footer = embed.footer?.text || '';
  const combined = desc + ' ' + footer;

  // 1. Try <@ID> mention — most reliable
  const mention = combined.match(/<@!?(\d+)>/);
  if (mention) return { hostId: mention[1], hostName: null };

  // 2. "Hosted by Username" / "Created by Username" / "Requested by Username"
  const nameMatch = combined.match(/(?:hosted|created|requested|started)\s+by\s+@?([a-z0-9_.]{2,32})/i);
  if (nameMatch) return { hostId: null, hostName: nameMatch[1] };

  // 3. Just "@Username" at the end of a line
  const atMatch = combined.match(/@([a-z0-9_.]{2,32})\s*$/im);
  if (atMatch) return { hostId: null, hostName: atMatch[1] };

  // 4. Fallback: use footer text if it looks like a username
  if (footer && /^[a-z0-9_.]{2,32}$/i.test(footer)) {
    return { hostId: null, hostName: footer };
  }

  return { hostId: null, hostName: null };
}

async function handleMessage(message) {
  if (!message.guild || !message.author.bot || !message.embeds?.length) return;

  const embed = message.embeds[0];
  if (!isGiveawayEmbed(embed)) return;

  const { hostId, hostName } = extractHost(embed);
  const name = hostName || 'Unknown';

  try {
    await Giveaway.create({
      guildId: message.guild.id,
      messageId: message.id,
      channelId: message.channel.id,
      hostId: hostId || message.author.id,
      hostName: name,
      prize: 'Giveaway',
      winners: 1,
      durationMs: 3600000,
      endsAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
    });
  } catch (err) {
    // ignore duplicate key errors
    if (err.code !== 11000) { /* noop */ }
  }
}

module.exports = { handleMessage };
