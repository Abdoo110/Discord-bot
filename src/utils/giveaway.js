const { buildEmbed } = require('./embed');

async function pickWinners(msg, giveaway, isReroll = false) {
  const reaction = msg.reactions.cache.get('🎉');
  if (!reaction) {
    await msg.reply({ embeds: [
      buildEmbed({ color: 'error', title: '❌ No Entries', description: 'No one reacted with 🎉.' })
    ]});
    return [];
  }

  const users = await reaction.users.fetch();
  const validUsers = [...users.values()].filter(u => !u.bot);

  if (validUsers.length === 0) {
    await msg.reply({ embeds: [
      buildEmbed({ color: 'error', title: '❌ No Valid Entries', description: 'No valid (non-bot) entries found.' })
    ]});
    return [];
  }

  const winCount = Math.min(giveaway.winners, validUsers.length);
  const shuffled = validUsers.sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, winCount);

  const winnerMentions = winners.map(w => `<@${w.id}>`).join(', ');

  await msg.reply({ content: isReroll ? `🎉 **RE-ROLL WINNER(S):** ${winnerMentions}` : `🎉 **WINNER(S):** ${winnerMentions}`, embeds: [
    buildEmbed({ color: 'giveaway', title: `🎉 ${giveaway.prize}`, description: [
      `**Winner(s):** ${winnerMentions}`,
      `**Hosted by:** <@${giveaway.hostId}>`,
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
      `**Winner(s):** ${winnerMentions}`,
      `**Hosted by:** <@${giveaway.hostId}>`,
      isReroll ? '*Re-rolled.*' : '',
    ].join('\n'),
    footer: 'Ended at',
    timestamp: new Date(),
  });
  try { await msg.edit({ embeds: [origEmbed] }); } catch (_) {}

  return winners;
}

module.exports = { pickWinners };
