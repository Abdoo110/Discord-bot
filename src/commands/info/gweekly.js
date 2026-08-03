const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gweekly')
    .setDescription('Weekly giveaway recap — see who hosted the most giveaways')
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

    // Count per host
    const hosts = {};
    for (const gw of giveaways) {
      const name = gw.hostName || 'Unknown';
      hosts[name] = (hosts[name] || 0) + 1;
    }

    const sorted = Object.entries(hosts).sort((a, b) => b[1] - a[1]);

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('📊 Weekly Giveaway Recap')
      .setDescription(`**${giveaways.length}** giveaway(s) by **${sorted.length}** user(s) this week.`)
      .setTimestamp();

    for (const [user, count] of sorted) {
      embed.addFields({ name: user, value: `**${count}** giveaway${count > 1 ? 's' : ''}`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
