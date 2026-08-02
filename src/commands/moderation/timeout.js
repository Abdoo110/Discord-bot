const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .addUserOption(o => o.setName('target').setDescription('User to timeout').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const durStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) return error(interaction, '❌ Error', 'That user is not in this server.');
    if (target.id === interaction.user.id) return error(interaction, '❌ Error', 'You cannot timeout yourself.');
    if (!member.moderatable) return error(interaction, '❌ Error', 'I cannot timeout this member.');

    const durationMs = ms(durStr);
    if (!durationMs || durationMs < 1000) return error(interaction, '❌ Error', 'Invalid duration. Use formats like: 10s, 5m, 1h, 1d');
    if (durationMs > 2419200000) return error(interaction, '❌ Error', 'Duration cannot exceed 28 days.');

    await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);
    await success(interaction, '⏱️ Member Timed Out',
      `**User:** ${target.tag} (${target.id})\n**Duration:** ${durStr}\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`);

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.modLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.modLogs);
      if (logChannel) {
        const { buildEmbed } = require('../../utils/embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'mod', title: '⏱️ Member Timed Out', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Duration', value: durStr, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
