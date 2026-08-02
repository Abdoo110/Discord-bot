const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, error } = require('../../utils/embed');
const Partner = require('../../models/Partner');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pleaderboard')
    .setDescription('Show the partner leaderboard')
    .setDMPermission(false),
  async execute(interaction) {
    const partners = await Partner.find({ guildId: interaction.guild.id }).sort({ partnerCount: -1 }).limit(25);
    if (partners.length === 0) return interaction.reply({ embeds: [buildEmbed({ color: 'partner', title: '🏆 Partner Leaderboard', description: 'No partner data yet.' })] });
    const fields = partners.map((p, i) => {
      const member = interaction.guild.members.cache.get(p.userId);
      const name = member ? member.user.tag : `Unknown (${p.userId})`;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return { name: `${medal} ${name}`, value: `**${p.partnerCount}** partner(s)`, inline: true };
    });
    await interaction.reply({ embeds: [buildEmbed({ color: 'partner', title: '🏆 Partner Leaderboard', fields, timestamp: Date.now() })] });
  },
};
