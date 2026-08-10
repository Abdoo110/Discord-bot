const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const Vouch = require('../../models/Vouch');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scamvouch')
    .setDescription('Report a scam vouch for a user')
    .addUserOption(o => o.setName('target').setDescription('User to scam vouch').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason / proof of scam'))
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (target.id === interaction.user.id) return error(interaction, '❌ Error', 'You cannot scam-vouch yourself.');
    if (target.bot) return error(interaction, '❌ Error', 'You cannot scam-vouch bots.');

    await Vouch.create({
      guildId: interaction.guild.id,
      targetId: target.id,
      authorId: interaction.user.id,
      type: 'scam',
      reason,
    });

    const [totalVouches, totalScams] = await Promise.all([
      Vouch.countDocuments({ guildId: interaction.guild.id, targetId: target.id, type: 'vouch' }),
      Vouch.countDocuments({ guildId: interaction.guild.id, targetId: target.id, type: 'scam' }),
    ]);

    const rep = totalVouches - totalScams;

    await success(interaction, '⚠️ Scam Vouch Added',
      `**User:** ${target.tag}\n**Reported By:** ${interaction.user.tag}\n**Reason:** ${reason}\n\n**Vouch Stats for ${target.username}:**\n👍 Vouches: **${totalVouches}** | 👎 Scams: **${totalScams}** | 📊 Reputation: **${rep}**`);

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.vouchLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.vouchLogs);
      if (logChannel) {
        logChannel.send({ embeds: [buildEmbed({ color: 'scam', title: '⚠️ New Scam Vouch', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Reported By', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
