const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const Staff = require('../../models/Staff');
const GuildConfig = require('../../models/GuildConfig');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Leave of Absence — set, cancel, or check your LOA status')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Go on LOA')
      .addStringOption(o => o.setName('reason').setDescription('Reason for your LOA').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('How long? (e.g. 3d, 1w, 2h)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('cancel')
      .setDescription('Cancel your active LOA'))
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Check your LOA status'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const staff = await Staff.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });

    if (!staff) return error(interaction, '❌ Not Staff', 'You are not registered as staff.');

    if (sub === 'set') {
      const reason = interaction.options.getString('reason');
      const durStr = interaction.options.getString('duration');
      const durMs = ms(durStr);

      if (!durMs || durMs < 3600000) return error(interaction, '❌ Error', 'Minimum LOA duration is 1 hour.');
      if (staff.loa.active) return error(interaction, '❌ Error', 'You already have an active LOA.');

      staff.loa = {
        active: true,
        reason,
        startedAt: new Date(),
        endsAt: new Date(Date.now() + durMs),
      };
      await staff.save();

      await success(interaction, '🔴 LOA Set',
        `**User:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Returns:** <t:${Math.floor(staff.loa.endsAt.getTime() / 1000)}:R>`);

      // Log
      const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });
      if (cfg?.channels?.staffLogs) {
        const logChannel = interaction.guild.channels.cache.get(cfg.channels.staffLogs);
        if (logChannel) {
          logChannel.send({ embeds: [buildEmbed({ color: 'info', title: '🔴 Staff LOA', fields: [
            { name: 'Staff', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Returns', value: `<t:${Math.floor(staff.loa.endsAt.getTime() / 1000)}:R>`, inline: true },
          ], timestamp: Date.now() })] });
        }
      }
    }

    if (sub === 'cancel') {
      if (!staff || !staff.loa.active) return error(interaction, '❌ Error', 'You do not have an active LOA.');

      staff.loa.active = false;
      await staff.save();
      await success(interaction, '🟢 LOA Cancelled', `**User:** ${interaction.user.tag}\nYou are now back from LOA.`);
    }

    if (sub === 'status') {
      if (staff.loa.active) {
        await interaction.reply({ embeds: [buildEmbed({ color: 'info', title: '🔴 LOA Status', fields: [
            { name: 'Status', value: '🔴 On LOA', inline: true },
            { name: 'Reason', value: staff.loa.reason, inline: true },
            { name: 'Started', value: `<t:${Math.floor(staff.loa.startedAt.getTime() / 1000)}:R>`, inline: true },
            { name: 'Returns', value: `<t:${Math.floor(staff.loa.endsAt.getTime() / 1000)}:R>`, inline: true },
        ]})] });
      } else {
        await interaction.reply({ embeds: [buildEmbed({ color: 'info',
            title: 'LOA Status',
            description: '🔴 Not on LOA' })] });
      }
    }
  },
};
