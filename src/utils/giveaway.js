const { buildEmbed } = require('./embed');

/**
 * Pick winners from a giveaway.
 * @param {Message} msg — the giveaway message
 * @param {Object} giveaway — Giveaway model doc
 * @param {boolean} [isReroll=false]
 */
async function pickWinners(msg, giveaway, isReroll = false) {
  if (giveaway.ended) return [];

  const entrants = giveaway.entrants || [];

  if (entrants.length === 0) {
    giveaway.ended = true;
    giveaway.endsAt = new Date();
    await giveaway.save();
    try { await msg.edit({ components: [] }); } catch (_) {}
    await msg.reply({ embeds: [
      buildEmbed({ color: 'error', title: '❌ No Entries', description: 'No one entered the giveaway.' })
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
      buildEmbed({ color: 'error', title: '❌ No Valid Entries', description: 'No valid (non-bot) entries found.' })
    ]});
    return [];
  }

  const winCount = Math.min(giveaway.winners, validMembers.length);
  const shuffled = validMembers.sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, winCount);

  const winnerMentions = winners.map(w => `<@${w.id}>`).join(', ');

  await msg.reply({ content: isReroll ? `🎉 **RE-ROLL WINNER(S):** ${winnerMentions}` : `🎉 **WINNER(S):** ${winnerMentions}`, embeds: [
    buildEmbed({ color: 'giveaway', title: `🎉 ${giveaway.prize}`, description: [
      `**Winner(s):** ${winnerMentions}`,
      `**Hosted By:** <@${giveaway.hostId}>`,
      `**Participants:** ${entrants.length}`,
      isReroll ? '*This giveaway was re-rolled.*' : '',
    ].join('\n'), timestamp: Date.now() })
  ]});

  giveaway.ended = true;
  giveaway.winnerIds = winners.map(w => w.id);
  if (isReroll) giveaway.rerolled = true;
  giveaway.endsAt = new Date();
  await giveaway.save();

  const origEmbed = buildEmbed({
    color: 'giveaway',
    title: `🎉 ${giveaway.prize} (ENDED)`,
    description: [
      `​`,
      `**Winner(s):** ${winnerMentions}`,
      `​`,
      `**Hosted By:** <@${giveaway.hostId}>`,
      `​`,
      `**Participants:** ${entrants.length}`,
      `​`,
      isReroll ? '*Re-rolled.*' : '',
    ].join('\n'),
  });
  try {
    await msg.edit({ embeds: [origEmbed], components: [] });
  } catch (_) {}

  return winners;
}

/**
 * End a giveaway by fetching its channel+message and calling pickWinners.
 */
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

/**
 * Schedule a giveaway to end exactly at its endsAt time.
 */
function scheduleEnd(client, giveaway) {
  const remaining = giveaway.endsAt.getTime() - Date.now();
  if (remaining <= 0) {
    endGiveaway(client, giveaway);
    return;
  }
  setTimeout(() => endGiveaway(client, giveaway), remaining);
}

module.exports = { pickWinners, endGiveaway, scheduleEnd };
