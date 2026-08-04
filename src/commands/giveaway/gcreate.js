const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { buildEmbed, error } = require('../../utils/embed');
const Giveaway = require('../../models/Giveaway');
const { parsePrizeValue } = require('../../handlers/giveawayTracker');
const { scheduleEnd } = require('../../utils/giveaway');
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
    .addStringOption(o => o.setName('claimtime').setDescription('Time winners have to claim (e.g. 5m, 1h). No limit if empty.'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),

  async execute(interaction) {
    const prize = interaction.options.getString('prize');
    const durStr = interaction.options.getString('duration');
    const winners = interaction.options.getInteger('winners') || 1;
    const claimTimeStr = interaction.options.getString('claimtime');

    let claimTimeMs = 0;
    if (claimTimeStr) {
      claimTimeMs = ms(claimTimeStr);
      if (!claimTimeMs || claimTimeMs < 0) return error(interaction, 'Error', 'Invalid claim time. Use formats like: 5m, 1h, 30m.');
    }

    const durationMs = ms(durStr);
    if (!durationMs || durationMs < 10000) return error(interaction, 'Error', 'Invalid duration. Minimum 10 seconds. Use formats like: 10m, 1h, 1d.');
    if (durationMs > 2592000000) return error(interaction, 'Error', 'Duration cannot exceed 30 days.');

    const endsAt = new Date(Date.now() + durationMs);

    const embed = buildEmbed({
      color: 'giveaway',
      title: `🎉 ${prize}`,
      description: [
        `​`,
        `**Hosted By:** ${interaction.user}`,
        `​`,
        `**Participants:** 0`,
        `​`,
        `**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
        `​`,
      ].join('\n'),
    });

    await interaction.reply({ embeds: [embed], fetchReply: true });
    const msg = await interaction.fetchReply();

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
      claimTimeMs,
      entrants: [],
    });

    const doc = await Giveaway.findOne({ messageId: msg.id });
    if (doc) scheduleEnd(interaction.client, doc);

    const button = new ButtonBuilder()
      .setCustomId(`giveaway_enter_${msg.id}`)
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);
    await msg.edit({ components: [row] });

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
