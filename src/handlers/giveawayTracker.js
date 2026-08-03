const Giveaway = require('../models/Giveaway');

/**
 * Detects giveaway messages from any bot.
 * GiveawayBot uses timestamps like <t:...> with "Ends:"
 */

// Bot usernames that are known giveaway bots (lowercase)
const GIVEAWAY_BOTS = [
  'giveawaybot', 'mee6', 'dyno', 'carl-bot', 'carlbot',
  'giveaway boat', 'prizebot', 'vibebot', 'cinnamon', 'arcane',
  'santa', 'giveaway', 'donut\'s helper',
];

function isGiveawayBot(username) {
  const lower = username.toLowerCase();
  return GIVEAWAY_BOTS.some(b => lower.includes(b));
}

// Check if embed looks like a giveaway
function looksLikeGiveaway(embed) {
  const desc = (embed.description || '').toLowerCase();
  const title = (embed.title || '').toLowerCase();
  const combined = title + ' ' + desc + ' ' + (embed.footer?.text || '');

  // Has timestamp like <t:...> with Ends/Winners/Prize
  if (/<t:\d+:[RrFfDdTt]>/.test(embed.description || '') &&
      /ends|winners|prize|entries/i.test(combined)) return true;

  // Has giveaway keywords (in case some bots still use them)
  if (/giveaway|give away|give-away/i.test(combined)) return true;

  return false;
}

function extractHostName(embed) {
  // Check footer first (GiveawayBot puts "Hosted by: @User" there)
  const footer = embed.footer?.text || '';
  const m1 = footer.match(/(?:hosted|requested|created|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
  if (m1) return m1[1].trim();

  // Check description
  const desc = embed.description || '';
  const m2 = desc.match(/(?:hosted|requested|created|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
  if (m2) return m2[1].trim();

  // Check embed fields for "Host" or "Hosted by"
  if (embed.fields) {
    for (const field of embed.fields) {
      const fName = field.name.toLowerCase();
      if (fName.includes('host')) return field.value.replace(/[@<>]/g, '');
      const m3 = field.value.match(/(?:hosted|requested|created|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
      if (m3) return m3[1].trim();
    }
  }

  // Check author
  if (embed.author?.name) return embed.author.name;

  return null;
}

async function handleMessage(message) {
  if (!message.guild || !message.author.bot) return;

  // Dump full embed for ALL embeds from unknown bots
  if (message.embeds?.length) {
    const e = message.embeds[0];
    const fields = (e.fields || []).map(f => `${f.name}=${f.value}`).join(' | ');
    console.log(`[TRACKER] "${message.author.username}" | title="${e.title}" | desc="${(e.description||'').slice(0,80)}" | footer="${e.footer?.text||''}" | author="${e.author?.name||''}" | fields=[${fields}]`);
  }

  if (!isGiveawayBot(message.author.username)) return;
  if (!message.embeds?.length) return;

  const embed = message.embeds[0];
  if (!looksLikeGiveaway(embed)) return;

  const hostName = extractHostName(embed) || 'Unknown';
  console.log(`[TRACKER] ✅ Giveaway by ${hostName}`);

  try {
    await Giveaway.create({
      guildId: message.guild.id,
      messageId: message.id,
      channelId: message.channel.id,
      hostId: message.author.id,
      hostName,
      prize: embed.title || 'Giveaway',
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
