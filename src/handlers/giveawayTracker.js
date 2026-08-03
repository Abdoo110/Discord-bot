const Giveaway = require('../models/Giveaway');

/**
 * Detects giveaway messages from any bot and tracks them.
 * Also tracks reaction adds to record participants.
 */

// Known giveaway bot patterns in embed titles
const GIVEAWAY_KEYWORDS = ['giveaway', 'give away', '🎉'];

function isGiveawayEmbed(embed) {
  const title = (embed.title || '').toLowerCase();
  const desc = (embed.description || '').toLowerCase();
  const text = title + ' ' + desc;
  return GIVEAWAY_KEYWORDS.some(kw => text.includes(kw));
}

function extractPrize(embed) {
  // Try to extract prize from common formats
  if (embed.title) {
    // "🎉 GIVEAWAY: Nitro" → "Nitro"
    const match = embed.title.match(/giveaway[:\s-]+(.+)/i);
    if (match) return match[1].trim();
    // "Nitro Giveaway" → "Nitro"
    const before = embed.title.match(/(.+)\s+giveaway/i);
    if (before) return before[1].trim();
    return embed.title.replace(/🎉|giveaway/gi, '').trim() || 'Unknown Prize';
  }
  if (embed.description) {
    const match = embed.description.match(/prize[:\s]*[`*]*(.+?)[`*\n]/i);
    if (match) return match[1].trim();
  }
  return 'Unknown Prize';
}

function extractEndsAt(embed, footer) {
  // Common format: "Ends in 1 hour" or "Ends at <t:1234567890:R>"
  const combined = ((embed.description || '') + ' ' + (footer?.text || '')).toLowerCase();

  // Try <t:UNIX> format
  const timestamp = combined.match(/<t:(\d+):[RrFfDdTt]>/);
  if (timestamp) return new Date(parseInt(timestamp[1]) * 1000);

  // Try "Ends in X hours/minutes"
  const endsIn = combined.match(/ends?\s+in\s+(\d+)\s*(second|minute|hour|day|week)s?/i);
  if (endsIn) {
    const num = parseInt(endsIn[1]);
    const multipliers = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000 };
    return new Date(Date.now() + num * (multipliers[endsIn[2].toLowerCase()] || 60000));
  }

  // Default: 1 hour from now
  return new Date(Date.now() + 3600000);
}

// ─── Message handler: detect giveaway creation ───
async function handleMessage(message) {
  if (!message.guild) return;
  if (!message.author.bot) return;
  if (!message.embeds || message.embeds.length === 0) return;

  for (const embed of message.embeds) {
    if (!isGiveawayEmbed(embed)) continue;

    const prize = extractPrize(embed);
    const endsAt = extractEndsAt(embed, embed.footer);
    const durationMs = endsAt.getTime() - Date.now();

    try {
      await Giveaway.create({
        guildId: message.guild.id,
        messageId: message.id,
        channelId: message.channel.id,
        hostId: message.author.id,
        hostName: message.author.username,
        hostBot: true,
        prize,
        winners: 1,
        durationMs: Math.max(durationMs, 60000),
        endsAt,
        participants: [],
        createdAt: new Date(),
      });
      console.log(`[GIVEAWAY TRACKER] Detected giveaway by ${message.author.username}: "${prize}"`);
    } catch (err) {
      // Duplicate messageId (already tracked) — ignore
      if (err.code !== 11000) console.error('[GIVEAWAY TRACKER] Error:', err.message);
    }

    return; // Only track first embed
  }
}

// ─── Reaction handler: track participants ───
async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.emoji.name !== '🎉') return;

  try {
    const giveaway = await Giveaway.findOne({ messageId: reaction.message.id });
    if (!giveaway) return;
    if (giveaway.ended) return;
    if (giveaway.participants.includes(user.id)) return;

    giveaway.participants.push(user.id);
    await giveaway.save();
  } catch (_) {}
}

// ─── Handle reaction remove (user removed their entry) ───
async function handleReactionRemove(reaction, user) {
  if (user.bot) return;
  if (reaction.emoji.name !== '🎉') return;

  try {
    const giveaway = await Giveaway.findOne({ messageId: reaction.message.id });
    if (!giveaway || giveaway.ended) return;

    giveaway.participants = giveaway.participants.filter(id => id !== user.id);
    await giveaway.save();
  } catch (_) {}
}

module.exports = { handleMessage, handleReactionAdd, handleReactionRemove };
