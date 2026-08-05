const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { buildEmbed, success, error } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a DM to a user as the bot')
    .addUserOption(o => o.setName('user').setDescription('The user to DM').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Your message').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const content = interaction.options.getString('message');

    try {
      await user.send({
        embeds: [new EmbedBuilder()
          .setTitle('📨 Message from Staff')
          .setDescription(content)
          .setColor('#5865F2')
          .setFooter({ text: `Sent from ${interaction.guild.name}` })
          .setTimestamp()
        ],
      });

      await interaction.reply({
        embeds: [buildEmbed({
          color: 'success',
          title: '✅ DM Sent',
          description: `Message sent to ${user.tag}`,
          fields: [{ name: 'Message', value: content }],
          timestamp: Date.now(),
        })],
        flags: MessageFlags.Ephemeral,
      });
    } catch (_) {
      await interaction.reply({
        embeds: [buildEmbed({
          color: 'error',
          title: '❌ Failed',
          description: `Could not DM ${user.tag}. They may have DMs disabled or have blocked the bot.`,
          timestamp: Date.now(),
        })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
