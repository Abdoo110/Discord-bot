const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const { formatValue } = require('../../handlers/giveawayTracker');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gweekly')
    .setDescription('Weekly giveaway recap — see who hosted the most + total prize value')
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const giveaways = await Giveaway.find({
      guildId: interaction.guild.id,
      createdAt: { $gte: oneWeekAgo },
    }).lean();

    if (!giveaways.length) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.warn)
          .setTitle('📊 Weekly Giveaway Recap')
          .setDescription('No giveaways tracked this week.')
        ]
      });
    }

    // Group by host: { name → { count, totalValue } }
    const hosts = {};
    for (const gw of giveaways) {
      const name = gw.hostName || 'Unknown';
      if (!hosts[name]) hosts[name] = { count: 0, totalValue: 0 };
      hosts[name].count++;
      hosts[name].totalValue += gw.prizeValue || 0;
    }

    const sorted = Object.entries(hosts).sort((a, b) => b[1].count - a[1].count);

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('📊 Weekly Giveaway Recap')
      .setDescription(`**${giveaways.length}** giveaway(s) by **${sorted.length}** user(s) this week.`)
      .setTimestamp();

    for (const [user, data] of sorted) {
      const money = data.totalValue > 0 ? ` | 💰 **${formatValue(data.totalValue)}**` : '';
      embed.addFields({
        name: user,
        value: `**${data.count}** giveaway${data.count > 1 ? 's' : ''}${money}`,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
