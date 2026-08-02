const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed } = require('../../utils/embed');
const activeGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fast')
    .setDescription('First to click wins!')
    .setDMPermission(false),
  async execute(interaction) {
    if (activeGames.has(interaction.channel.id)) return interaction.reply({ embeds: [buildEmbed({ color: 'error', title: '⚠️ Already Active', description: 'There is already an active fast-click game in this channel.' })], ephemeral: true });
    const embed = buildEmbed({ color: 'fun', title: '⚡ FAST CLICK — First to React Wins!', description: `React with ⚡ as fast as you can!\n\nGame started by ${interaction.user.tag}`, footer: 'Hurry!', timestamp: Date.now() });
    await interaction.reply({ embeds: [embed] });
    const msg = await interaction.fetchReply();
    await msg.react('⚡');
    activeGames.set(interaction.channel.id, { messageId: msg.id, startedAt: Date.now() });
    const filter = (reaction, user) => reaction.emoji.name === '⚡' && !user.bot;
    const collector = msg.createReactionCollector({ filter, time: 60000, max: 1 });
    collector.on('collect', async (reaction, user) => {
      const gameData = activeGames.get(interaction.channel.id);
      activeGames.delete(interaction.channel.id);
      const elapsedMs = gameData ? Date.now() - gameData.startedAt : 0;
      await interaction.channel.send({ embeds: [buildEmbed({ color: 'fun', title: '⚡ WINNER!', description: `🎉 **${user.tag}** was the fastest to click!\nThey reacted in **${(elapsedMs / 1000).toFixed(2)} seconds**!`, thumbnail: user.displayAvatarURL({ dynamic: true }), timestamp: Date.now() })] });
      collector.stop();
    });
    collector.on('end', async (collected) => {
      if (collected.size === 0) { activeGames.delete(interaction.channel.id); await interaction.channel.send({ embeds: [buildEmbed({ color: 'warn', title: "⏰ Time's Up!", description: 'No one clicked in time. Game over!' })] }); }
    });
  },
};
