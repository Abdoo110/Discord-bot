const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gweekly')
    .setDescription('Weekly giveaway recap grouped by bot')
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const giveaways = await Giveaway.find({
      guildId: interaction.guild.id,
      createdAt: { $gte: oneWeekAgo },
    });

    if (giveaways.length === 0) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.warn)
          .setTitle('📊 Weekly Giveaway Recap')
          .setDescription('No giveaways tracked this week.')
        ]
      });
    }

    // Count per bot
    const bots = {};
    for (const gw of giveaways) {
      const name = gw.hostName || 'Unknown';
      bots[name] = (bots[name] || 0) + 1;
    }

    const sorted = Object.entries(bots).sort((a, b) => b[1] - a[1]);

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('📊 Weekly Giveaway Recap')
      .setDescription(`**${giveaways.length}** giveaway(s) from **${sorted.length}** bot(s) this week.`)
      .setTimestamp();

    for (const [bot, count] of sorted) {
      embed.addFields({ name: bot, value: `**${count}** giveaway${count > 1 ? 's' : ''}`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
