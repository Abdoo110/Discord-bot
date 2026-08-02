const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const { setChannel } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unpsetup')
    .setDescription('Disable the partner tracking channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async execute(interaction) {
    await setChannel(interaction.guild.id, 'partnerChannel', null);
    await success(interaction, '❌ Partner System Disabled', 'Partner tracking channel has been disabled.');
  },
};
