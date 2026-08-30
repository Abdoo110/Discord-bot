const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel (prevents members from sending messages)')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to lock (defaults to current)').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('reason').setDescription('Reason for locking'))
    .setDMPermission(false)
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!channel.permissionsFor(interaction.guild.roles.everyone).has('SendMessages')) {
      return error(interaction, '❌ Already Locked', 'This channel is already locked.');
    }

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    await success(interaction, '🔒 Channel Locked', `**Channel:** ${channel}\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`);
  },
};
