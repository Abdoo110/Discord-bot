const { SlashCommandBuilder } = require('discord.js');
const { success, error } = require('../../utils/embed');
const Staff = require('../../models/Staff');
const { getConfig } = require('../../utils/guildConfig');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Request or manage a Leave of Absence')
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Start a leave of absence')
      .addStringOption(o => o.setName('reason').setDescription('Reason for LOA').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 3d, 1w)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('end')
      .setDescription('End your current leave of absence'))
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Check LOA status of a staff member')
      .addUserOption(o => o.setName('member').setDescription('Staff member to check')))
    .setDMPermission(false),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const reason = interaction.options.getString('reason');
      const durStr = interaction.options.getString('duration');
      const durationMs = ms(durStr);
      if (!durationMs) return error(interaction, '❌ Error', 'Invalid duration. Use formats like: 1d, 3d, 1w');

      let staff = await Staff.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      if (!staff) return error(interaction, '❌ Error', 'You are not registered as staff. Use `/staffinfo` first.');

      if (staff.loa.active) return error(interaction, '❌ Error', 'You already have an active LOA.');

      staff.loa = {
        active: true,
        reason,
        startedAt: new Date(),
        endsAt: new Date(Date.now() + durationMs),
      };
      await staff.save();

      await success(interaction, '🏖️ LOA Started',
        `**Staff:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Duration:** ${durStr}\n**Return:** <t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`);

      const cfg = await getConfig(interaction.guild.id);
      if (cfg.channels.staffLogs) {
        const logChannel = interaction.guild.channels.cache.get(cfg.channels.staffLogs);
        if (logChannel) {
          const { buildEmbed } = require('../../utils/embed');
          logChannel.send({ embeds: [buildEmbed({ color: 'staff', title: '🏖️ Staff LOA Started', fields: [
            { name: 'Staff', value: interaction.user.tag, inline: true },
            { name: 'Duration', value: durStr, inline: true },
            { name: 'Reason', value: reason, inline: false },
          ], timestamp: Date.now() })] });
        }
      }
    } else if (sub === 'end') {
      let staff = await Staff.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      if (!staff || !staff.loa.active) return error(interaction, '❌ Error', 'You do not have an active LOA.');

      staff.loa.active = false;
      await staff.save();

      await success(interaction, '✅ LOA Ended', 'Your leave of absence has been ended. Welcome back!');
    } else if (sub === 'status') {
      const member = interaction.options.getUser('member') || interaction.user;
      const staff = await Staff.findOne({ guildId: interaction.guild.id, userId: member.id });
      if (!staff) return error(interaction, '❌ Error', 'That user is not registered as staff.');

      const { buildEmbed } = require('../../utils/embed');
      if (staff.loa.active) {
        await interaction.reply({ embeds: [
          buildEmbed({ color: 'staff', title: `🏖️ LOA Status — ${member.username}`, fields: [
            { name: 'Status', value: '🔴 On LOA', inline: true },
            { name: 'Reason', value: staff.loa.reason, inline: true },
            { name: 'Started', value: `<t:${Math.floor(staff.loa.startedAt.getTime() / 1000)}:R>`, inline: true },
            { name: 'Returns', value: `<t:${Math.floor(staff.loa.endsAt.getTime() / 1000)}:R>`, inline: true },
          ] })
        ]});
      } else {
        await interaction.reply({ embeds: [
          buildEmbed({ color: 'staff', title: `🏖️ LOA Status — ${member.username}`,
            description: '🟢 Not on LOA' })
        ]});
      }
    }
  },
};
