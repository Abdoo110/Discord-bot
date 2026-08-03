const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { success } = require('../../utils/embed');
const Partner = require('../../models/Partner');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetpartners')
    .setDescription('Reset the partner leaderboard (Owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ embeds: [
        require('../../utils/embed').buildEmbed({ color: 'error', title: '❌ Owner Only', description: 'Only the server owner can reset the partner leaderboard.' })
      ], flags: MessageFlags.Ephemeral });
    }

    await Partner.deleteMany({ guildId: interaction.guild.id });
    await success(interaction, '🔄 Partner Leaderboard Reset', 'All partner data has been cleared.');
  },
};
