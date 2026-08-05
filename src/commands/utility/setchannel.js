const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { buildEmbed, success } = require('../../utils/embed');
const { setChannel, setRole } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Configure a channel for bot features')
    .addStringOption(o => o.setName('type').setDescription('What channel to configure').setRequired(true)
      .addChoices(
        { name: 'Mod Logs', value: 'modLogs' },
        { name: 'Message Logs', value: 'messageLogs' },
        { name: 'Warning Logs', value: 'warningLogs' },
        { name: 'Vouch Logs', value: 'vouchLogs' },
        { name: 'Staff Logs', value: 'staffLogs' },
        { name: 'Giveaway Logs', value: 'giveawayLogs' },
        { name: 'Bug Reports', value: 'bugReports' },
        { name: 'Partner Channel', value: 'partnerChannel' },
        { name: 'Orders Channel', value: 'ordersChannel' },
        { name: 'Order Paid Channel', value: 'orderPaidChannel' },
        { name: 'Claim IGNs Channel', value: 'claimIGNsChannel' },
        { name: 'Giveaway Proof Channel', value: 'giveawayProofChannel' },
      ))
    .addChannelOption(o => o.setName('channel').setDescription('The channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');

    await setChannel(interaction.guild.id, type, channel.id);

    const labels = {
      modLogs: 'Mod Logs',
      messageLogs: 'Message Logs',
      warningLogs: 'Warning Logs',
      vouchLogs: 'Vouch Logs',
      staffLogs: 'Staff Logs',
      giveawayLogs: 'Giveaway Logs',
      bugReports: 'Bug Reports',
      partnerChannel: 'Partner Channel',
      ordersChannel: 'Orders Channel',
      orderPaidChannel: 'Order Paid Channel',
      claimIGNsChannel: 'Claim IGNs Channel',
      giveawayProofChannel: 'Giveaway Proof Channel',
    };

    await success(interaction, 'Channel Configured', `**${labels[type]}** has been set to ${channel}.`);
  },
};
