const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const Warning = require('../../models/Warning');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a member')
    .addUserOption(o => o.setName('target').setDescription('User to clear warnings for').setRequired(true))
    .setDefaultMemberPermissions(0)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');

    const result = await Warning.deleteMany({ guildId: interaction.guild.id, userId: target.id });

    if (result.deletedCount === 0) {
      return error(interaction, '📭 No Warnings', `${target.tag} has no warnings to clear.`);
    }

    await success(interaction, '✅ Warnings Cleared',
      `Successfully cleared **${result.deletedCount}** warning(s) for ${target.tag}.\n**Moderator:** ${interaction.user.tag}`);
  },
};
