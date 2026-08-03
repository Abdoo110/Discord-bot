const Giveaway = require('../models/Giveaway');

const GIVEAWAY_PATTERNS = ['giveaway', 'give away', 'give-away'];

function isGiveawayEmbed(embed) {
  const text = ((embed.title || '') + ' ' + (embed.description || '')).toLowerCase();
  const extra = ((embed.author?.name || '') + ' ' + (embed.footer?.text || '')).toLowerCase();
  return GIVEAWAY_PATTERNS.some(p => (text + ' ' + extra).includes(p));
}

function extractHostName(embed) {
  const desc = embed.description || '';
  const footer = embed.footer?.text || '';
  const combined = desc + ' ' + footer;

  const m = combined.match(/(?:hosted|created|requested|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
  if (m) return m[1].trim();

  if (footer && /^[a-z0-9_.]{2,32}$/i.test(footer.trim())) return footer.trim();
  return null;
}

async function handleMessage(message) {
  if (!message.guild || !message.author.bot) return;

  // Log ALL bot messages even without embeds
  if (!message.embeds?.length) {
    console.log(`[TRACKER] Bot "${message.author.username}" — NO embeds. content="${(message.content||'').slice(0,80)}"`);
    return;
  }

  const embed = message.embeds[0];
  console.log(`[TRACKER] Bot "${message.author.username}" | title="${embed.title?.slice(0,60)}" | desc="${(embed.description||'').slice(0,60)}" | footer="${embed.footer?.text||''}" | author="${embed.author?.name||''}"`);

  if (!isGiveawayEmbed(embed)) {
    console.log(`[TRACKER] ❌ Not a giveaway embed`);
    return;
  }

  const hostName = extractHostName(embed) || 'Unknown';
  console.log(`[TRACKER] ✅ Giveaway detected! Host: ${hostName}`);

  try {
    await Giveaway.create({
      guildId: message.guild.id,
      messageId: message.id,
      channelId: message.channel.id,
      hostId: message.author.id,
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
