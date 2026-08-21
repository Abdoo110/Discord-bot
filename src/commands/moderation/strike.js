const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const GuildConfig = require('../../models/GuildConfig');
const Warning = require('../../models/Warning');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Issue a strike/warning to a member')
    .addUserOption(o => o.setName('target').setDescription('User to strike').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for strike').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const member = interaction.guild.members.cache.get(target.id);

    if (target.id === interaction.user.id) return error(interaction, '❌ Error', 'You cannot strike yourself.');
    if (target.bot) return error(interaction, '❌ Error', 'You cannot strike bots.');

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

    await success(interaction, '⚡ Strike Issued',
      `**User:** <@${target.id}> (${target.id})\n**Case:** #${caseNum}\n**Reason:** ${reason}\n**Total Strikes:** ${totalWarnings}\n**Moderator:** ${interaction.user.tag}`);

    try {
      await target.send({ embeds: [
        require('../../utils/embed').buildEmbed({ color: 'warn', title: '⚡ You Received a Strike',
          description: `**Server:** ${interaction.guild.name}\n**Case:** #${caseNum}\n**Reason:** ${reason}\n**Total Strikes:** ${totalWarnings}` })
      ]});
    } catch (_) {}

    const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (cfg?.channels.warningLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.warningLogs);
      if (logChannel) {
        const { buildEmbed } = require('../../utils/embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'warn', title: '⚡ Strike Issued', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Case', value: `#${caseNum}`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Total Strikes', value: `${totalWarnings}`, inline: true },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
