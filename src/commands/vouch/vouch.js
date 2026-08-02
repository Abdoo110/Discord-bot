const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');
const Vouch = require('../../models/Vouch');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Vouch for a trusted user')
    .addUserOption(o => o.setName('target').setDescription('User to vouch for').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for vouching'))
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (target.id === interaction.user.id) return error(interaction, '❌ Error', 'You cannot vouch for yourself.');
    if (target.bot) return error(interaction, '❌ Error', 'You cannot vouch for bots.');

    const existing = await Vouch.findOne({
      guildId: interaction.guild.id,
      targetId: target.id,
      authorId: interaction.user.id,
      type: 'vouch',
    });

    if (existing) return error(interaction, '❌ Already Vouched', `You have already vouched for ${target.tag}.`);

    await Vouch.create({
      guildId: interaction.guild.id,
      targetId: target.id,
      authorId: interaction.user.id,
      type: 'vouch',
      reason,
    });

    const [totalVouches, totalScams] = await Promise.all([
      Vouch.countDocuments({ guildId: interaction.guild.id, targetId: target.id, type: 'vouch' }),
      Vouch.countDocuments({ guildId: interaction.guild.id, targetId: target.id, type: 'scam' }),
    ]);

    const rep = totalVouches - totalScams;

    await success(interaction, '✅ Vouch Added',
      `**User:** ${target.tag}\n**Vouched By:** ${interaction.user.tag}\n**Reason:** ${reason}\n\n**Vouch Stats for ${target.username}:**\n👍 Vouches: **${totalVouches}** | 👎 Scams: **${totalScams}** | 📊 Reputation: **${rep}**`);

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.vouchLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.vouchLogs);
      if (logChannel) {
        logChannel.send({ embeds: [buildEmbed({ color: 'vouch', title: '✅ New Vouch', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Vouched By', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
