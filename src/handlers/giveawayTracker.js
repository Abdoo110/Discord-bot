const Giveaway = require('../models/Giveaway');

const GIVEAWAY_BOTS = [
  'giveawaybot', 'mee6', 'dyno', 'carl-bot', 'carlbot',
  'giveaway boat', 'prizebot', 'vibebot', 'cinnamon', 'arcane',
  'santa', 'giveaway', 'donut\'s helper',
];

function isGiveawayBot(username) {
  return GIVEAWAY_BOTS.some(b => username.toLowerCase().includes(b));
}

function looksLikeGiveaway(embed) {
  const combined = ((embed.title || '') + ' ' + (embed.description || '') + ' ' + (embed.footer?.text || '')).toLowerCase();
  if (/<t:\d+:[RrFfDdTt]>/.test(embed.description || '') && /ends|winners|prize|entries/i.test(combined)) return true;
  if (/giveaway|give away|give-away/i.test(combined)) return true;
  return false;
}

/**
 * Parse numeric value from prize string.
 * "5M" → 5000000, "5.5m" → 5500000, "10K" → 10000, "1B" → 1000000000
 * "1000000" → 1000000, "Nitro" → 0
 */
function parsePrizeValue(prize) {
  const cleaned = String(prize).replace(/,/g, '').trim();
  const match = cleaned.match(/^([\d.]+)\s*([mkb])$/i);
  if (match) {
    const num = parseFloat(match[1]);
    const suffix = match[2].toUpperCase();
    if (suffix === 'K') return Math.round(num * 1000);
    if (suffix === 'M') return Math.round(num * 1000000);
    if (suffix === 'B') return Math.round(num * 1000000000);
  }
  const pure = cleaned.match(/^(\d+)$/);
  if (pure) return parseInt(pure[1], 10);
  return 0;
}

/**
 * Format a number back to readable form.
 * 5000000 → "5M", 10000 → "10K", 1500000 → "1.5M"
 */
function formatValue(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function extractHostName(embed) {
  const footer = embed.footer?.text || '';
  const desc = embed.description || '';

  const m1 = footer.match(/(?:hosted|requested|created|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
  if (m1) return m1[1].trim();

  const m2 = desc.match(/(?:hosted|requested|created|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
  if (m2) return m2[1].trim();

  if (embed.fields) {
    for (const field of embed.fields) {
      if (field.name.toLowerCase().includes('host')) return field.value.replace(/[@<>]/g, '');
      const m3 = field.value.match(/(?:hosted|requested|created|started)\s+by\s+@?([a-z0-9_.\s]{2,32})/i);
      if (m3) return m3[1].trim();
    }
  }

  if (embed.author?.name) return embed.author.name;
  return null;
}

async function handleMessage(message) {
  if (!message.guild || !message.author.bot) return;

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
  const prize = embed.title || 'Giveaway';
  const prizeValue = parsePrizeValue(prize);

  console.log(`[TRACKER] ✅ Giveaway by ${hostName} — prize="${prize}" (${formatValue(prizeValue) || 'non-numeric'})`);

  try {
    await Giveaway.create({
      guildId: message.guild.id,
      messageId: message.id,
      channelId: message.channel.id,
      hostId: message.author.id,
      hostName,
      prize,
      prizeValue,
      winners: 1,
      durationMs: 3600000,
      endsAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
    });
  } catch (err) {
    if (err.code !== 11000) console.error('[TRACKER] DB Error:', err.message);
  }
}

module.exports = { handleMessage, formatValue, parsePrizeValue };
