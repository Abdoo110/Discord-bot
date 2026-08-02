const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function buildEmbed(opts = {}) {
  const colorKey = opts.color || 'default';
  const color = config.colors[colorKey] || config.colors.default;

  const embed = new EmbedBuilder()
    .setColor(color);

  if (opts.title) embed.setTitle(opts.title);
  if (opts.description) embed.setDescription(opts.description);
  if (opts.fields) embed.addFields(opts.fields);
  if (opts.footer) embed.setFooter({ text: opts.footer });
  if (opts.thumbnail) embed.setThumbnail(opts.thumbnail);
  if (opts.image) embed.setImage(opts.image);
  if (opts.timestamp) embed.setTimestamp(opts.timestamp);
  if (opts.author) {
    embed.setAuthor({
      name: opts.author,
      iconURL: opts.authorIcon || undefined,
    });
  }

  return embed;
}

function success(interactionOrMsg, title, description) {
  const embed = buildEmbed({ color: 'success', title, description, timestamp: Date.now() });
  return interactionOrMsg.reply ? interactionOrMsg.reply({ embeds: [embed] }) : interactionOrMsg.channel.send({ embeds: [embed] });
}

function error(interactionOrMsg, title, description) {
  const embed = buildEmbed({ color: 'error', title, description, timestamp: Date.now() });
  return interactionOrMsg.reply ? interactionOrMsg.reply({ embeds: [embed], ephemeral: true }) : interactionOrMsg.channel.send({ embeds: [embed] });
}

function warn(interactionOrMsg, title, description) {
  const embed = buildEmbed({ color: 'warn', title, description, timestamp: Date.now() });
  return interactionOrMsg.reply ? interactionOrMsg.reply({ embeds: [embed] }) : interactionOrMsg.channel.send({ embeds: [embed] });
}

function info(interactionOrMsg, title, description) {
  const embed = buildEmbed({ color: 'info', title, description, timestamp: Date.now() });
  return interactionOrMsg.reply ? interactionOrMsg.reply({ embeds: [embed] }) : interactionOrMsg.channel.send({ embeds: [embed] });
}

module.exports = { buildEmbed, success, error, warn, info };
