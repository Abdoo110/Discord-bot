const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, error } = require('../../utils/embed');
const Giveaway = require('../../models/Giveaway');
const { pickWinners } = require('../../utils/giveaway');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greroll')
    .setDescription('Re-roll winners for a giveaway')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),
  async execute(interaction) {
    const messageId = interaction.options.getString('message_id');
    const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId, ended: true });
    if (!giveaway) return error(interaction, '❌ Not Found', 'No ended giveaway found with that message ID.');
    const channel = interaction.guild.channels.cache.get(giveaway.channelId);
    if (!channel) return error(interaction, '❌ Error', 'Channel not found.');
    let msg;
    try { msg = await channel.messages.fetch(messageId); } catch (_) { return error(interaction, '❌ Error', 'Giveaway message not found.'); }
    giveaway.rerolled = true;
    await pickWinners(msg, giveaway, true);
    await giveaway.save();
    await interaction.reply({ embeds: [buildEmbed({ color: 'success', title: '🎉 Giveaway Re-rolled', description: `New winner(s) have been selected for **${giveaway.prize}**.` })] });
  },
};
