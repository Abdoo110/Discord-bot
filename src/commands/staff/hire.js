const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const Staff = require('../../models/Staff');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hire')
    .setDescription('Hire a new staff member')
    .addUserOption(o => o.setName('target').setDescription('User to hire').setRequired(true))
    .addStringOption(o => o.setName('position').setDescription('Position (e.g. Moderator, Admin)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const member = interaction.guild.members.cache.get(target.id);
    const position = interaction.options.getString('position') || 'Staff';

    if (target.bot) return error(interaction, '❌ Error', 'You cannot hire bots.');

    let staff = await Staff.findOne({ guildId: interaction.guild.id, userId: target.id });
    if (staff) return error(interaction, '❌ Error', `${target.tag} is already a staff member.`);

    staff = await Staff.create({
      guildId: interaction.guild.id,
      userId: target.id,
      position,
      hiredAt: new Date(),
    });

    const cfg = await getConfig(interaction.guild.id);
    if (member && cfg.roles.staffRole) {
      await member.roles.add(cfg.roles.staffRole).catch(() => {});
    }

    await success(interaction, '🎉 Staff Hired',
      `**User:** ${target.tag}\n**Position:** ${position}\n**Hired By:** ${interaction.user.tag}`);

    if (cfg.channels.staffLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.staffLogs);
      if (logChannel) {
        const { buildEmbed } = require('../../utils/embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'success', title: '🎉 Staff Hired', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Position', value: position, inline: true },
          { name: 'Hired By', value: interaction.user.tag, inline: true },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
