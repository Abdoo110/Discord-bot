const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success } = require('../../utils/embed');
const { setRole } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Configure a role for bot features')
    .addStringOption(o => o.setName('type').setDescription('What role to configure').setRequired(true)
      .addChoices(
        { name: 'Staff Role', value: 'staffRole' }, { name: 'Admin Role', value: 'adminRole' },
        { name: 'Moderator Role', value: 'moderatorRole' }, { name: 'Muted Role', value: 'mutedRole' },
        { name: 'Activity Role', value: 'activityRole' },
      ))
    .addRoleOption(o => o.setName('role').setDescription('The role').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async execute(interaction) {
    const type = interaction.options.getString('type');
    const role = interaction.options.getRole('role');
    await setRole(interaction.guild.id, type, role.id);
    const labels = { staffRole:'Staff Role', adminRole:'Admin Role', moderatorRole:'Moderator Role', mutedRole:'Muted Role', activityRole:'Activity Role' };
    await success(interaction, '✅ Role Configured', `**${labels[type]}** has been set to ${role}.`);
  },
};
