const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const GuildConfig = require('../../models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bugreport')
    .setDescription('Submit a bug report')
    .addStringOption(o => o.setName('description').setDescription('Describe the bug in detail').setRequired(true))
    .addAttachmentOption(o => o.setName('screenshot').setDescription('Optional screenshot'))
    .setDMPermission(false),
  async execute(interaction) {
    const description = interaction.options.getString('description');
    const screenshot = interaction.options.getAttachment('screenshot');
    const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!cfg?.channels.bugReports) return error(interaction, '❌ Bug Reports Not Configured', 'The bug report channel has not been set up. Ask an admin to configure it using `/setchannel bugreports #channel`.');
    const reportChannel = interaction.guild.channels.cache.get(cfg.channels.bugReports);
    if (!reportChannel) return error(interaction, '❌ Error', 'Bug report channel not found. It may have been deleted.');
    const reportEmbed = buildEmbed({ color: 'warn', title: '🐛 Bug Report', description, fields: [
      { name: 'Reported By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
      { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
    ], image: screenshot?.url, timestamp: Date.now() });
    await reportChannel.send({ embeds: [reportEmbed] });
    await success(interaction, '✅ Bug Report Submitted', 'Your bug report has been sent to the staff team. Thank you!');
  },
};
