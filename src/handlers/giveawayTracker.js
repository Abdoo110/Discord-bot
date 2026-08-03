const Giveaway = require('../models/Giveaway');

/**
 * Detects giveaway messages from any bot.
 * Most giveaway bots use embeds with "giveaway" in the title/description,
 * or post a message that gets a 🎉 reaction from the bot itself.
 */

const GIVEAWAY_PATTERNS = ['giveaway', 'give away', '🎉', 'give-away'];

function isGiveawayEmbed(embed) {
  const text = ((embed.title || '') + ' ' + (embed.description || '')).toLowerCase();
  // Also check author name and footer
  const extra = ((embed.author?.name || '') + ' ' + (embed.footer?.text || '')).toLowerCase();
  return GIVEAWAY_PATTERNS.some(p => (text + ' ' + extra).includes(p));
}

function extractHost(embed) {
  const desc = embed.description || '';
  const footer = embed.footer?.text || '';
  const combined = desc + ' ' + footer;

  // <@ID> mention
  const mention = combined.match(/<@!?(\d+)>/);
  if (mention) return mention[1];

  // "Hosted/Created/Requested/Started by Name"
  const m = combined.match(/(?:hosted|created|requested|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
  if (m) return null;

  return null;
}

function extractHostName(embed) {
  const desc = embed.description || '';
  const footer = embed.footer?.text || '';
  const combined = desc + ' ' + footer;

  // "Hosted by Name"
  const m = combined.match(/(?:hosted|created|requested|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
  if (m) return m[1].trim();

  // If footer is just a username
  if (footer && /^[a-z0-9_.]{2,32}$/i.test(footer.trim())) return footer.trim();

  return null;
}

async function handleMessage(message) {
  if (!message.guild || !message.author.bot || !message.embeds?.length) return;

  const embed = message.embeds[0];

  // DEBUG
  console.log(`[TRACKER] Bot message from ${message.author.username}: title="${embed.title}", desc="${(embed.description||'').slice(0,60)}", footer="${embed.footer?.text||''}"`);

  if (!isGiveawayEmbed(embed)) return;

  const hostId = extractHost(embed);
  const hostName = extractHostName(embed) || 'Unknown';

  console.log(`[TRACKER] ✅ Detected giveaway! Host: ${hostName}`);

  try {
    await Giveaway.create({
      guildId: message.guild.id,
      messageId: message.id,
      channelId: message.channel.id,
      hostId: hostId || message.author.id,
      hostName,
      prize: 'Giveaway',
      winners: 1,
      durationMs: 3600000,
      endsAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
    });
  } catch (err) {
    if (err.code !== 11000) console.error('[TRACKER] DB Error:', err.message);
  }
}

module.exports = { handleMessage };
