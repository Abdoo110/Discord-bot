const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error, buildEmbed } = require('../../utils/embed');
const Warning = require('../../models/Warning');
const GuildConfig = require('../../models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strikesremove')
    .setDescription('Remove strikes from a member')
    .addUserOption(o => o.setName('target').setDescription('User to remove strikes from').setRequired(true))
    .addIntegerOption(o => o.setName('count').setDescription('Number of strikes to remove (default: 1)').setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(0)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const count = interaction.options.getInteger('count') || 1;

    if (target.bot) return error(interaction, '❌ Error', 'Bots don\'t have strikes.');

    const warnings = await Warning.find({ guildId: interaction.guild.id, userId: target.id })
      .sort({ createdAt: -1 })
      .limit(count);

    if (warnings.length === 0) {
      return error(interaction, '❌ No Strikes', `${target.tag} has no strikes to remove.`);
    }

    const ids = warnings.map(w => w._id);
    await Warning.deleteMany({ _id: { $in: ids } });

    const newTotal = await Warning.countDocuments({ guildId: interaction.guild.id, userId: target.id });
    const removed = warnings.length;

    await success(interaction, '🗑️ Strikes Removed',
      `**User:** ${target.tag} (${target.id})\n**Removed:** ${removed} strike(s)\n**Remaining:** ${newTotal}\n**Moderator:** ${interaction.user.tag}`);

    const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (cfg?.channels?.warningLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.warningLogs);
      if (logChannel) {
        logChannel.send({ embeds: [buildEmbed({ color: 'info', title: '🗑️ Strikes Removed', fields: [
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Removed', value: `${removed}`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Remaining Strikes', value: `${newTotal}`, inline: true },
        ], timestamp: Date.now() })] });
      }
    }
  },
};
