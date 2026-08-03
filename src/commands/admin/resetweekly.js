const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Giveaway = require('../../models/Giveaway');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetweekly')
    .setDescription('Reset ALL tracked giveaway data (admin only)')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 }); // ephemeral

    const result = await Giveaway.deleteMany({ guildId: interaction.guild.id });
    const count = result.deletedCount || 0;

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('🔄 Weekly Reset')
        .setDescription(`Deleted **${count}** tracked giveaway(s). Fresh start!`)
      ]
    });
  },
};
