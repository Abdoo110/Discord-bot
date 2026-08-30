const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, MessageFlags } = require('discord.js');
const { buildEmbed } = require('../../utils/embed');

// In-memory tracking for active fast-click games, one game per channel.
const activeGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fast')
    .setDescription('First to press the button wins!')
    .setDMPermission(false),

  async execute(interaction) {
    if (activeGames.has(interaction.channel.id)) {
      return interaction.reply({ embeds: [
        buildEmbed({ color: 'error', title: '⚠️ Already Active', description: 'There is already an active fast game in this channel.' })
      ], flags: MessageFlags.Ephemeral });
    }

    const button = new ButtonBuilder()
      .setCustomId('fast_claim')
      .setLabel('⚡ PRESS FIRST')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(button);
    const embed = buildEmbed({
      color: 'fun',
      title: '⚡ FAST — First to Press Wins!',
      description: 'Press the button as fast as you can!\n\nStarted by ' + interaction.user.tag,
      footer: 'The first valid press wins • 60 seconds',
      timestamp: Date.now(),
    });

    await interaction.reply({ embeds: [embed], components: [row] });
    const message = await interaction.fetchReply();
    const game = { messageId: message.id, startedAt: Date.now(), claimed: false };
    activeGames.set(interaction.channel.id, game);

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (game.claimed) {
        return buttonInteraction.reply({ content: 'This game already has a winner.', flags: MessageFlags.Ephemeral });
      }

      // Claim before awaiting a network operation so the first event wins.
      game.claimed = true;
      activeGames.delete(interaction.channel.id);
      const elapsedMs = Date.now() - game.startedAt;
      const winnerName = buttonInteraction.member?.displayName || buttonInteraction.user.globalName || buttonInteraction.user.username;
      const winnerEmbed = buildEmbed({
        color: 'success',
        title: '⚡ WINNER!',
        description: '🎉 **' + winnerName + '** was first to press!\n<@' + buttonInteraction.user.id + '> won in **' + (elapsedMs / 1000).toFixed(2) + ' seconds**.',
        thumbnail: buttonInteraction.user.displayAvatarURL({ dynamic: true }),
        timestamp: Date.now(),
      });

      const disabledRow = new ActionRowBuilder().addComponents(button.setDisabled(true).setLabel('🏆 ' + winnerName));
      await buttonInteraction.update({ embeds: [winnerEmbed], components: [disabledRow] });
      collector.stop('winner');
    });

    collector.on('end', async (_, reason) => {
      if (activeGames.get(interaction.channel.id)?.messageId === message.id) {
        activeGames.delete(interaction.channel.id);
      }
      if (reason === 'winner') return;

      const endedRow = new ActionRowBuilder().addComponents(button.setDisabled(true).setLabel("⏰ TIME'S UP"));
      await message.edit({
        embeds: [buildEmbed({ color: 'warn', title: "⏰ Time's Up!", description: 'No one pressed in time. Game over!' })],
        components: [endedRow],
      }).catch(() => {});
    });
  },
};
