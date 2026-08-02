const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, error } = require('../../utils/embed');

const snipeCache = new Map();

function addSnipe(message) {
  snipeCache.set(message.channel.id, {
    content: message.content,
    author: message.author,
    attachments: [...message.attachments.values()],
    embeds: message.embeds,
    createdAt: message.createdTimestamp,
    deletedAt: Date.now(),
  });
}

function getSnipe(channelId) {
  return snipeCache.get(channelId) || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Retrieve the last deleted message in this channel')
    .setDMPermission(false),

  async execute(interaction) {
    const snipe = getSnipe(interaction.channel.id);
    if (!snipe) return error(interaction, '🔍 Nothing to Snipe', 'There are no recently deleted messages in this channel.');

    const embed = buildEmbed({
      color: 'info',
      author: snipe.author.tag,
      authorIcon: snipe.author.displayAvatarURL({ dynamic: true }),
      description: snipe.content || '*No text content*',
      footer: `Deleted at ${new Date(snipe.deletedAt).toLocaleTimeString()}`,
      timestamp: snipe.createdAt,
    });

    if (snipe.attachments.length > 0) {
      embed.setImage(snipe.attachments[0].url);
      embed.addFields({ name: '📎 Attachments', value: `${snipe.attachments.length} attachment(s)` });
    }

    await interaction.reply({ embeds: [embed] });
  },
  addSnipe,
  getSnipe,
};
