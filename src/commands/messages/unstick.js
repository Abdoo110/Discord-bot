const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const StickyMessage = require('../../models/StickyMessage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unstick')
    .setDescription('Remove the stuck message from the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute(interaction) {
    const existing = await StickyMessage.findOne({ guildId: interaction.guild.id, channelId: interaction.channel.id });
    if (!existing) return error(interaction, '❌ No Sticky', 'There is no stuck message in this channel.');
    try { const oldMsg = await interaction.channel.messages.fetch(existing.messageId); if (oldMsg) await oldMsg.delete(); } catch (_) {}
    await StickyMessage.deleteOne({ guildId: interaction.guild.id, channelId: interaction.channel.id });
    await success(interaction, '✅ Message Unstuck', 'The stuck message has been removed.');
  },
};
