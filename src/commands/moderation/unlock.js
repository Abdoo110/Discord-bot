const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel (restores sending permissions)')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to unlock (defaults to current)').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('reason').setDescription('Reason for unlocking'))
    .setDMPermission(false)
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (channel.permissionsFor(interaction.guild.roles.everyone).has('SendMessages')) {
      return error(interaction, '❌ Already Unlocked', 'This channel is already unlocked.');
    }

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await success(interaction, '🔓 Channel Unlocked', `**Channel:** ${channel}\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`);
  },
};
