const { buildEmbed } = require('./embed');
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

async function pickWinners(msg, giveaway, isReroll = false) {
  if (giveaway.ended) return [];

  const entrants = giveaway.entrants || [];

  if (entrants.length === 0) {
    giveaway.ended = true;
    giveaway.endsAt = new Date();
    await giveaway.save();
    try { await msg.edit({ components: [] }); } catch (_) {}
    await msg.reply({ embeds: [
      buildEmbed({ color: 'error', title: 'No Entries', description: 'No one entered the giveaway.' })
    ]});
    return [];
  }

  const uniqueEntrants = [...new Set(entrants)];
  const guild = msg.guild;

  const validMembers = [];
  for (const userId of uniqueEntrants) {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && !member.user.bot) validMembers.push(member);
    } catch (_) {}
  }

  if (validMembers.length === 0) {
    await msg.reply({ embeds: [
      buildEmbed({ color: 'error', title: 'No Valid Entries', description: 'No valid (non-bot) entries found.' })
    ]});
    return [];
  }

  const winCount = Math.min(giveaway.winners, validMembers.length);
  const shuffled = validMembers.sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, winCount);

  const winnerMentions = winners.map(w => `<@${w.id}>`).join(', ');

  const claimBtn = new ButtonBuilder()
    .setCustomId(`giveaway_claim_${msg.id}`)
    .setLabel('Claim')
    .setStyle(ButtonStyle.Success);
  const claimRow = new ActionRowBuilder().addComponents(claimBtn);

  const replyMsg = await msg.reply({ content: isReroll ? `Re-roll Winner(s): ${winnerMentions}` : `Winner(s): ${winnerMentions}`, embeds: [
    buildEmbed({ color: 'giveaway', title: `${giveaway.prize}`, description: [
      `**Winner(s):** ${winnerMentions}`,
      `**Hosted By:** <@${giveaway.hostId}>`,
      `**Participants:** ${entrants.length}`,
      isReroll ? '*This giveaway was re-rolled.*' : '',
    ].join('\n'), timestamp: Date.now() })
  ], components: [claimRow] });

  giveaway.ended = true;
  giveaway.winnerIds = winners.map(w => w.id);
  if (isReroll) giveaway.rerolled = true;
  giveaway.endsAt = new Date();
  await giveaway.save();

  const origEmbed = buildEmbed({
    color: 'giveaway',
    title: `${giveaway.prize} (ENDED)`,
    description: [
      '\u200b',
      `**Winner(s):** ${winnerMentions}`,
      '\u200b',
      `**Hosted By:** <@${giveaway.hostId}>`,
      '\u200b',
      `**Participants:** ${entrants.length}`,
      '\u200b',
      isReroll ? '*Re-rolled.*' : '',
    ].join('\n'),
  });

  try {
    await msg.edit({ embeds: [origEmbed], components: [] });
  } catch (_) {}

  if (giveaway.claimTimeMs && giveaway.claimTimeMs > 0) {
    giveaway.claimMessageId = replyMsg.id;
    scheduleClaimExpiry(msg.client, giveaway._id, giveaway.claimTimeMs, replyMsg.id);
  }

  return winners;
}

async function endGiveaway(client, giveaway) {
  const Giveaway = require('../models/Giveaway');
  const fresh = await Giveaway.findById(giveaway._id);
  if (!fresh || fresh.ended) return;

  const channel = await client.channels.fetch(fresh.channelId).catch(() => null);
  if (!channel) return;
  const msg = await channel.messages.fetch(fresh.messageId).catch(() => null);
  if (!msg) return;

  await pickWinners(msg, fresh);
  console.log(`[END] Ended giveaway "${fresh.prize}" (guild ${fresh.guildId})`);
}

function scheduleEnd(client, giveaway) {
  const remaining = giveaway.endsAt.getTime() - Date.now();
  if (remaining <= 0) {
    endGiveaway(client, giveaway);
    return;
  }
  setTimeout(() => endGiveaway(client, giveaway), remaining);
}

function scheduleClaimExpiry(client, giveawayId, claimTimeMs, claimMsgId) {
  setTimeout(async () => {
    try {
      const Giveaway = require('../models/Giveaway');
      const gw = await Giveaway.findById(giveawayId);
      if (!gw) return;

      const channel = await client.channels.fetch(gw.channelId).catch(() => null);
      if (!channel) return;
      const msgId = claimMsgId || gw.claimMessageId || gw.messageId;
      const msg = await channel.messages.fetch(msgId).catch(() => null);
      if (!msg || !msg.embeds[0]) return;

      const oldEmbed = EmbedBuilder.from(msg.embeds[0]);
      const oldTitle = oldEmbed.data.title || '';
      const newTitle = oldTitle.replace(' (ENDED)', ' (CLAIM EXPIRED)');
      const emb = EmbedBuilder.from(msg.embeds[0]).setTitle(newTitle);
      await msg.edit({ embeds: [emb], components: [] });
      console.log(`[CLAIM] Claim expired for giveaway ${giveawayId}`);
    } catch (err) {
      console.error('[CLAIM-EXPIRY]', err.message);
    }
  }, claimTimeMs);
}

module.exports = { pickWinners, endGiveaway, scheduleEnd, scheduleClaimExpiry };
