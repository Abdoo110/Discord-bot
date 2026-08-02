const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of messages')
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    let filtered = [...messages.values()].slice(0, amount);

    if (targetUser) {
      filtered = filtered.filter(m => m.author.id === targetUser.id);
    }

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    filtered = filtered.filter(m => m.createdTimestamp > twoWeeksAgo);

    if (filtered.length === 0) {
      return interaction.editReply({ embeds: [
        require('../../utils/embed').buildEmbed({ color: 'warn', title: '⚠️ No Messages', description: 'No messages found or they are older than 14 days.' })
      ]});
    }

    await interaction.channel.bulkDelete(filtered, true);

    await interaction.editReply({ embeds: [
      require('../../utils/embed').buildEmbed({ color: 'success', title: '🧹 Messages Purged',
        description: `Successfully deleted **${filtered.length}** message(s)${targetUser ? ` from ${targetUser.tag}` : ''}.` })
    ]});

    const cfg = await getConfig(interaction.guild.id);
    if (cfg.channels.modLogs) {
      const logChannel = interaction.guild.channels.cache.get(cfg.channels.modLogs);
      if (logChannel) {
        const { buildEmbed } = require('../../utils/embed');
        logChannel.send({ embeds: [buildEmbed({ color: 'mod', title: '🧹 Messages Purged', fields: [
          { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
          { name: 'Amount', value: `${filtered.length}`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          ...(targetUser ? [{ name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: true }] : []),
        ], timestamp: Date.now() })] });
      }
    }
  },
};
