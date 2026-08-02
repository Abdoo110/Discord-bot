const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const Staff = require('../../models/Staff');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demotion')
    .setDescription('Demote a staff member')
    .addUserOption(o => o.setName('target').setDescription('Staff member to demote').setRequired(true))
    .addStringOption(o => o.setName('new_position').setDescription('New (lower) position'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const newPosition = interaction.options.getString('new_position') || 'Staff';

    const staff = await Staff.findOne({ guildId: interaction.guild.id, userId: target.id });
    if (!staff) return error(interaction, '❌ Error', `${target.tag} is not a staff member.`);

    const oldPosition = staff.position;
    staff.position = newPosition;
    await staff.save();

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.roles.staffRole && newPosition.toLowerCase() === 'member') {
      const member = interaction.guild.members.cache.get(target.id);
      if (member) await member.roles.remove(cfg.roles.staffRole).catch(() => {});
    }

    await success(interaction, '📉 Staff Demoted',
      `**User:** ${target.tag}\n**Old Position:** ${oldPosition}\n**New Position:** ${newPosition}\n**Demoted By:** ${interaction.user.tag}`);

    if (cfg.channels.staffLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.staffLogs);
      if (logChannel) {
        const { buildEmbed } = require('../../utils/embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'warn', title: '📉 Staff Demoted', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Old Position', value: oldPosition, inline: true },
          { name: 'New Position', value: newPosition, inline: true },
          { name: 'Demoted By', value: interaction.user.tag, inline: true },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
