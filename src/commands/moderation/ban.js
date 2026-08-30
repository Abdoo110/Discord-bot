const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(o => o.setName('target').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the ban'))
    .addIntegerOption(o => o.setName('days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(0)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const days = interaction.options.getInteger('days') || 0;
    const member = interaction.guild.members.cache.get(target.id);

    if (target.id === interaction.user.id) return error(interaction, '❌ Error', 'You cannot ban yourself.');
    if (target.id === interaction.client.user.id) return error(interaction, '❌ Error', 'I cannot ban myself.');
    if (member && !member.bannable) return error(interaction, '❌ Error', 'I cannot ban this member. They may have higher permissions.');
    if (member && member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return error(interaction, '❌ Error', 'You cannot ban someone with a higher or equal role.');
    }

    await interaction.guild.members.ban(target, { deleteMessageDays: days, reason: `${interaction.user.tag}: ${reason}` });

    await success(interaction, '🔨 Member Banned',
      `**User:** ${target.tag} (${target.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}${days > 0 ? `\n**Messages Cleared:** ${days} day(s)` : ''}`);

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.modLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.modLogs);
      if (logChannel) {
        const { buildEmbed } = require('../../utils/embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'error', title: '🔨 Member Banned', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
