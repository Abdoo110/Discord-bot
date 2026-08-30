const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(o => o.setName('target').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the kick'))
    .setDefaultMemberPermissions(0)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(target.id);

    if (target.id === interaction.user.id) return error(interaction, '❌ Error', 'You cannot kick yourself.');
    if (!member) return error(interaction, '❌ Error', 'That user is not in this server.');
    if (!member.kickable) return error(interaction, '❌ Error', 'I cannot kick this member.');
    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return error(interaction, '❌ Error', 'You cannot kick someone with a higher or equal role.');
    }

    await member.kick(`${interaction.user.tag}: ${reason}`);
    await success(interaction, '👢 Member Kicked', `**User:** ${target.tag} (${target.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`);

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.modLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.modLogs);
      if (logChannel) {
        const { buildEmbed } = require('../../utils/embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'warn', title: '👢 Member Kicked', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
