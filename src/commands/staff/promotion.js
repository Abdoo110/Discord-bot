const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const Staff = require('../../models/Staff');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promotion')
    .setDescription('Promote a staff member')
    .addUserOption(o => o.setName('target').setDescription('Staff member to promote').setRequired(true))
    .addStringOption(o => o.setName('new_position').setDescription('New position').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const newPosition = interaction.options.getString('new_position');

    const staff = await Staff.findOne({ guildId: interaction.guild.id, userId: target.id });
    if (!staff) return error(interaction, '❌ Error', `${target.tag} is not a staff member.`);

    const oldPosition = staff.position;
    staff.position = newPosition;
    await staff.save();

    await success(interaction, '📈 Staff Promoted',
      `**User:** ${target.tag}\n**Old Position:** ${oldPosition}\n**New Position:** ${newPosition}\n**Promoted By:** ${interaction.user.tag}`);

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.staffLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.staffLogs);
      if (logChannel) {
        const { buildEmbed } = require('../../utils/embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'staff', title: '📈 Staff Promoted', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Old Position', value: oldPosition, inline: true },
          { name: 'New Position', value: newPosition, inline: true },
          { name: 'Promoted By', value: interaction.user.tag, inline: true },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
