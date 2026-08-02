const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const Warning = require('../../models/Warning');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warning')
    .setDescription('Warn a member')
    .addUserOption(o => o.setName('target').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');

    if (target.id === interaction.user.id) return error(interaction, '❌ Error', 'You cannot warn yourself.');
    if (target.bot) return error(interaction, '❌ Error', 'You cannot warn bots.');

    const lastWarning = await Warning.findOne({ guildId: interaction.guild.id }).sort({ caseNumber: -1 });
    const caseNum = lastWarning ? lastWarning.caseNumber + 1 : 1;

    await Warning.create({
      guildId: interaction.guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
      caseNumber: caseNum,
    });

    const totalWarnings = await Warning.countDocuments({ guildId: interaction.guild.id, userId: target.id });

    await success(interaction, '⚠️ Warning Issued',
      `**User:** ${target.tag}\n**Case:** #${caseNum}\n**Reason:** ${reason}\n**Total Warnings:** ${totalWarnings}\n**Moderator:** ${interaction.user.tag}`);

    try {
      await target.send({ embeds: [
        buildEmbed({ color: 'warn', title: '⚠️ Warning Received',
          description: `**Server:** ${interaction.guild.name}\n**Case:** #${caseNum}\n**Reason:** ${reason}\n**Total Warnings:** ${totalWarnings}` })
      ]});
    } catch (_) {}

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.warningLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.warningLogs);
      if (logChannel) {
        logChannel.send({ embeds: [buildEmbed({ color: 'warn', title: '⚠️ Warning Issued', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Case', value: `#${caseNum}`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Total Warnings', value: `${totalWarnings}`, inline: true },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
