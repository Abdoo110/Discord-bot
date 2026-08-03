const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const Giveaway = require('../../models/Giveaway');
const { parsePrizeValue } = require('../../handlers/giveawayTracker');
const { getConfig } = require('../../utils/guildConfig');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gcreate')
    .setDescription('Create a giveaway')
    .addStringOption(o => o.setName('prize').setDescription('The prize to win').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20))
    .addStringOption(o => o.setName('requirements').setDescription('Any special requirements'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),

  async execute(interaction) {
    const prize = interaction.options.getString('prize');
    const durStr = interaction.options.getString('duration');
    const winners = interaction.options.getInteger('winners') || 1;
    const requirements = interaction.options.getString('requirements');

    const durationMs = ms(durStr);
    if (!durationMs || durationMs < 10000) return error(interaction, 'Error', 'Invalid duration. Minimum 10 seconds.');
    if (durationMs > 2592000000) return error(interaction, 'Error', 'Duration cannot exceed 30 days.');

    const endsAt = new Date(Date.now() + durationMs);

    const embed = buildEmbed({
      color: 'giveaway',
      title: `🎉 ${prize}`,
      description: [
        `React with 🎉 to enter!`,
        `**Winners:** ${winners}`,
        `**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
        requirements ? `**Requirements:** ${requirements}` : '',
        '',
        `**Hosted by:** ${interaction.user.tag}`,
      ].join('\n'),
      footer: 'Ends at',
      timestamp: endsAt,
    });

    await interaction.reply({ content: '🎉 **GIVEAWAY** 🎉', embeds: [embed] });
    const msg = await interaction.fetchReply();
    await msg.react('🎉');

    await Giveaway.create({
      guildId: interaction.guild.id,
      messageId: msg.id,
      channelId: interaction.channel.id,
      hostId: interaction.user.id,
      hostName: interaction.user.username,
      prize,
      prizeValue: parsePrizeValue(prize),
      winners,
      durationMs,
      endsAt,
    });

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.giveawayLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.giveawayLogs);
      if (logChannel) {
        logChannel.send({ embeds: [buildEmbed({ color: 'giveaway', title: '🎉 Giveaway Created', fields: [
          { name: 'Prize', value: prize, inline: true },
          { name: 'Winners', value: `${winners}`, inline: true },
          { name: 'Duration', value: durStr, inline: true },
          { name: 'Host', value: interaction.user.tag, inline: true },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
