const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { success, error } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Send a message as the bot')
    .addStringOption(o => o.setName('message').setDescription('The message to send').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (defaults to current)').addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute(interaction) {
    const content = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    await channel.send({ embeds: [require('../../utils/embed').buildEmbed({ color: 'info', description: content })] });
    await interaction.reply({ embeds: [require('../../utils/embed').buildEmbed({ color: 'success', title: '✅ Message Sent', description: `Message sent to ${channel}.` })], ephemeral: true });
  },
};
