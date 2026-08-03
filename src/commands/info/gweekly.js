const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gweekly')
    .setDescription('View giveaway stats from all bots this week')
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const giveaways = await Giveaway.find({
      guildId: interaction.guild.id,
      createdAt: { $gte: oneWeekAgo },
    }).sort({ createdAt: -1 });

    if (giveaways.length === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.warn)
            .setTitle('📊 Weekly Giveaway Recap')
            .setDescription('No giveaways tracked this week.')
        ]
      });
    }

    // Group by bot host
    const bots = {};
    for (const gw of giveaways) {
      const key = gw.hostName || gw.hostId;
      if (!bots[key]) {
        bots[key] = {
          hostName: gw.hostName,
          hostId: gw.hostId,
          totalGiveaways: 0,
          activeGiveaways: 0,
          endedGiveaways: 0,
          totalParticipants: 0,
          uniqueParticipants: new Set(),
          prizes: [],
        };
      }
      const b = bots[key];
      b.totalGiveaways++;
      if (gw.ended) {
        b.endedGiveaways++;
      } else {
        b.activeGiveaways++;
      }
      const pCount = gw.participants?.length || 0;
      b.totalParticipants += pCount;
      gw.participants?.forEach(id => b.uniqueParticipants.add(id));
      b.prizes.push(gw.prize);
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('📊 Weekly Giveaway Recap')
      .setDescription(`Tracked **${giveaways.length}** giveaway(s) from **${Object.keys(bots).length}** bot(s) this week.`)
      .setTimestamp();

    for (const [botName, data] of Object.entries(bots)) {
      const status = data.activeGiveaways > 0 ? '🟢' : '🔴';
      const value = [
        `**Total:** ${data.totalGiveaways} (${data.endedGiveaways} ended, ${data.activeGiveaways} active)`,
        `**Total Entries:** ${data.totalParticipants}`,
        `**Unique Users:** ${data.uniqueParticipants.size}`,
        `**Prizes:** ${data.prizes.slice(0, 5).join(', ')}${data.prizes.length > 5 ? '...' : ''}`,
      ].join('\n');

      embed.addFields({ name: `${status} ${botName}`, value, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
