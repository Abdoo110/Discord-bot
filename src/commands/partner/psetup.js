const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embed');
const { setChannel } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('psetup')
    .setDescription('Set the partner tracking channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel for partner tracking').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await setChannel(interaction.guild.id, 'partnerChannel', channel.id);
    await success(interaction, '✅ Partner System Setup', `Partner tracking channel has been set to ${channel}.`);
  },
};
