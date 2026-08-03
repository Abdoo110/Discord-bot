const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, error } = require('../../utils/embed');
const Staff = require('../../models/Staff');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('finfo')
    .setDescription('Force-check staff info for a user')
    .addUserOption(o => o.setName('target').setDescription('Staff member to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const staff = await Staff.findOne({ guildId: interaction.guild.id, userId: target.id });

    if (!staff) {
      return error(interaction, '❌ Not Found', `${target.tag} is not registered as staff.`);
    }

    await interaction.reply({ embeds: [
      buildEmbed({ color: 'staff', title: `📋 Staff Info — ${target.username}`, fields: [
        { name: 'Discord', value: target.tag, inline: true },
        { name: 'IGN', value: staff.ign || 'Not set', inline: true },
        { name: 'Timezone', value: staff.timezone || 'Not set', inline: true },
        { name: 'Position', value: staff.position, inline: true },
        { name: 'Hired', value: `<t:${Math.floor(staff.hiredAt.getTime() / 1000)}:D>`, inline: true },
        { name: 'LOA', value: staff.loa.active ? `🔴 On LOA until <t:${Math.floor(staff.loa.endsAt.getTime() / 1000)}:R>` : '🔴 Active', inline: false },
      ], thumbnail: target.displayAvatarURL({ dynamic: true }) })
    ]});
  },
};
