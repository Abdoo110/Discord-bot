const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed } = require('../../utils/embed');
const Giveaway = require('../../models/Giveaway');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gweekly')
    .setDescription('Show giveaway stats for all staff members this week')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),
  async execute(interaction) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const giveaways = await Giveaway.find({ guildId: interaction.guild.id, createdAt: { $gte: startOfWeek } });
    if (giveaways.length === 0) return interaction.reply({ embeds: [buildEmbed({ color: 'giveaway', title: '📊 Weekly Giveaway Stats', description: 'No giveaways have been created this week.' })] });
    const stats = {};
    for (const gw of giveaways) {
      if (!stats[gw.hostId]) stats[gw.hostId] = { created: 0, ended: 0, prizes: [] };
      stats[gw.hostId].created++;
      stats[gw.hostId].prizes.push(gw.prize);
      if (gw.ended) stats[gw.hostId].ended++;
    }
    const fields = [];
    for (const [hostId, data] of Object.entries(stats)) {
      const member = interaction.guild.members.cache.get(hostId);
      const name = member ? member.user.tag : hostId;
      fields.push({ name, value: `**Created:** ${data.created} | **Ended:** ${data.ended}\nPrizes: ${data.prizes.slice(0, 3).join(', ')}${data.prizes.length > 3 ? ` +${data.prizes.length - 3} more` : ''}`, inline: false });
    }
    await interaction.reply({ embeds: [buildEmbed({ color: 'giveaway', title: '📊 Weekly Giveaway Stats', description: `Total giveaways this week: **${giveaways.length}**`, fields, timestamp: Date.now() })] });
  },
};
