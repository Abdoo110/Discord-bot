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
  const stripMd = (str) => str.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '').replace(/~~/g, '');

  const footer = stripMd(embed.footer?.text || '');
  const desc = stripMd(embed.description || '');

  const tryPatterns = (text) => {
    let m = text.match(/(?:hosted|requested|created|started)\s+by\s*:?\s*@?([\S]{2,32})/i);
    if (m && !/\b(bot|giveaway|ends?|winners?|prize|entries?|react|enter)\b/i.test(m[1])) return m[1];
    m = text.match(/by\s+@?([\S]{2,32})\s*$/im);
    if (m && !/\b(bot|giveaway|ends?|winners?|prize|entries?|react|enter)\b/i.test(m[1])) return m[1];
    return null;
  };

  const fromFooter = tryPatterns(footer);
  if (fromFooter) return fromFooter;

  const fromDesc = tryPatterns(desc);
  if (fromDesc) return fromDesc;

  if (embed.fields) {
    for (const field of embed.fields) {
      const fName = stripMd(field.name || '');
      const fVal = stripMd(field.value || '');
      if (/host/i.test(fName)) return fVal.replace(/[@<>]/g, '').trim().slice(0, 32);
      const m = tryPatterns(fVal);
      if (m) return m;
    }
  }

  if (embed.author?.name && !/\b(bot|giveaway|prize)\b/i.test(embed.author.name)) {
    return embed.author.name.replace(/[@<>]/g, '').trim().slice(0, 32);
  }

  return null;
}

async function handleMessage(message) {
  if (!message.guild || !message.author.bot) return;

  if (message.embeds?.length) {
    const e = message.embeds[0];
    const fields = (e.fields || []).map(f => `${f.name}=${(f.value || '').slice(0,40)}`).join(' | ');
    const intUser = message.interaction?.user?.username || 'none';
    console.log(`[TRACKER] "${message.author.username}" | intUser=${intUser} | title="${e.title}" | footer="${e.footer?.text||''}" | author="${e.author?.name||''}" | fields=[${fields}]`);
  }

  if (!isGiveawayBot(message.author.username)) return;
  if (!message.embeds?.length) return;

  const embed = message.embeds[0];
  if (!looksLikeGiveaway(embed)) return;

  let hostName = message.interaction?.user?.username || null;
  let hostId = message.interaction?.user?.id || null;

  if (!hostName) hostName = extractHostFromEmbed(embed);
  if (!hostName) hostName = 'Unknown';
  if (!hostId) hostId = message.author.id;

  const prize = embed.title || 'Giveaway';
  const prizeValue = parsePrizeValue(prize);

  console.log(`[TRACKER] ✅ Giveaway by ${hostName} (${hostId}) — prize="${prize}" (${formatValue(prizeValue) || 'non-numeric'})`);

  try {
    await Giveaway.create({
      guildId: message.guild.id,
      messageId: message.id,
      channelId: message.channel.id,
      hostId,
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
