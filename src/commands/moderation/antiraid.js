const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildEmbed } = require('../../utils/embed');
const GuildConfig = require('../../models/GuildConfig');
const { manualLockdown, manualUnlock } = require('../../handlers/antiAbuse');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Manage anti-raid / anti-spam / anti-nuke protection and server lockdown')
    .addSubcommand(sub => sub
      .setName('toggle')
      .setDescription('Toggle a protection module on or off')
      .addStringOption(o => o
        .setName('module')
        .setDescription('Which protection to toggle')
        .setRequired(true)
        .addChoices(
          { name: 'Anti-Spam', value: 'antiSpamEnabled' },
          { name: 'Anti-Raid', value: 'antiRaidEnabled' },
          { name: 'Anti-Nuke', value: 'antiNukeEnabled' },
        ))
      .addBooleanOption(o => o.setName('enabled').setDescription('Enabled (true) or disabled (false)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('lockdown')
      .setDescription('Manually lock all channels (Staff can still type)'))
    .addSubcommand(sub => sub
      .setName('unlock')
      .setDescription('Manually unlock all channels'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });

    if (sub === 'toggle') {
      const moduleKey = interaction.options.getString('module');
      const enabled = interaction.options.getBoolean('enabled');

      if (!cfg) {
        const created = new GuildConfig({ guildId: interaction.guild.id, [moduleKey]: enabled });
        await created.save();
      } else {
        cfg[moduleKey] = enabled;
        await cfg.save();
      }

      const labels = { antiSpamEnabled: 'Anti-Spam', antiRaidEnabled: 'Anti-Raid', antiNukeEnabled: 'Anti-Nuke' };
      return interaction.reply({
        embeds: [buildEmbed({
          color: enabled ? 'success' : 'warn',
          title: enabled ? '✅ Protection Enabled' : '⛔ Protection Disabled',
          description: `**${labels[moduleKey]}** is now **${enabled ? 'ON' : 'OFF'}**.`,
          timestamp: Date.now(),
        })],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'lockdown') {
      await manualLockdown(interaction.guild, interaction.member);
      return interaction.reply({
        embeds: [buildEmbed({ color: 'warn', title: '🔒 Lockdown', description: 'All channels have been locked.', timestamp: Date.now() })],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'unlock') {
      await manualUnlock(interaction.guild, interaction.member);
      return interaction.reply({
        embeds: [buildEmbed({ color: 'success', title: '🔓 Unlocked', description: 'All channels have been unlocked.', timestamp: Date.now() })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
