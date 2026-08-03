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

function formatValue(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function extractHostFromEmbed(embed) {
  const footer = embed.footer?.text || '';
  const desc = embed.description || '';

  const m1 = footer.match(/(?:hosted|requested|created|started)\s+by\s+@?([\w\s]{2,32})/i);
  if (m1) return m1[1].trim();

  const m2 = desc.match(/(?:hosted|requested|created|started)\s+by\s+@?([\w\s]{2,32})/i);
  if (m2) return m2[1].trim();

  if (embed.fields) {
    for (const field of embed.fields) {
      if (/host/i.test(field.name)) return field.value.replace(/[@<>]/g, '').trim();
      const m3 = field.value.match(/(?:hosted|requested|created|started)\s+by\s+@?([\w\s]{2,32})/i);
      if (m3) return m3[1].trim();
    }
  }

  if (embed.author?.name && !/giveaway/i.test(embed.author.name)) return embed.author.name;
  return null;
}

async function handleMessage(message) {
  if (!message.guild || !message.author.bot) return;

  // Log ALL bot embeds for debugging
  if (message.embeds?.length) {
    const e = message.embeds[0];
    const fields = (e.fields || []).map(f => `${f.name}=${f.value.slice(0,40)}`).join(' | ');
    const intUser = message.interaction?.user?.username || 'none';
    console.log(`[TRACKER] "${message.author.username}" | intUser=${intUser} | title="${e.title}" | footer="${e.footer?.text||''}" | author="${e.author?.name||''}" | fields=[${fields}]`);
  }

  if (!isGiveawayBot(message.author.username)) return;
  if (!message.embeds?.length) return;

  const embed = message.embeds[0];
  if (!looksLikeGiveaway(embed)) return;

  // 1. Try message.interaction.user (the person who ran /gstart)
  let hostName = message.interaction?.user?.username || null;

  // 2. Fallback: extract from embed
  if (!hostName) hostName = extractHostFromEmbed(embed);

  // 3. Last resort
  if (!hostName) hostName = 'Unknown';

  const prize = embed.title || 'Giveaway';
  const prizeValue = parsePrizeValue(prize);

  console.log(`[TRACKER] ✅ Giveaway by ${hostName} — prize="${prize}" (${formatValue(prizeValue) || 'non-numeric'})`);

  try {
    await Giveaway.create({
      guildId: message.guild.id,
      messageId: message.id,
      channelId: message.channel.id,
      hostId: hostName !== 'Unknown' ? message.interaction?.user?.id || message.author.id : message.author.id,
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
