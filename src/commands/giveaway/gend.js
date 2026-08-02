const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const Giveaway = require('../../models/Giveaway');
const { pickWinners } = require('../../utils/giveaway');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway early')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),
  async execute(interaction) {
    const messageId = interaction.options.getString('message_id');
    const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId, ended: false });
    if (!giveaway) return error(interaction, '❌ Not Found', 'No active giveaway found with that message ID.');
    const channel = interaction.guild.channels.cache.get(giveaway.channelId);
    if (!channel) return error(interaction, '❌ Error', 'Giveaway channel not found.');
    let msg;
    try { msg = await channel.messages.fetch(messageId); } catch (_) { return error(interaction, '❌ Error', 'Giveaway message not found.'); }
    await pickWinners(msg, giveaway);
    await interaction.reply({ embeds: [buildEmbed({ color: 'success', title: '✅ Giveaway Ended', description: `The giveaway for **${giveaway.prize}** has been ended.` })] });
  },
};
