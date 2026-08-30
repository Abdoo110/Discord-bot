const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get a link to invite this bot to another server')
    .setDMPermission(false),

  async execute(interaction) {
    if (!config.botInvite) {
      return interaction.reply({ content: 'The bot invite link is not available because CLIENT_ID is not configured.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Invite the Bot')
      .setDescription('Use the button below to invite this bot to a server where you have permission to add bots.')
      .setColor('#5865F2')
      .setTimestamp();

    const button = new ButtonBuilder()
      .setLabel('Invite Bot')
      .setStyle(ButtonStyle.Link)
      .setURL(config.botInvite);

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(button)],
    });
  },
};