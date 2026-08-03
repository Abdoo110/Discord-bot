const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orderembed')
    .setDescription('Create an order embed with a sticker and an Order button')
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Embed description (single line)').setRequired(true))
    .addAttachmentOption(o => o.setName('sticker').setDescription('Upload sticker/image'))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (default: current channel)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const sticker = interaction.options.getAttachment('sticker');
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      const cfg = await getConfig(interaction.guild.id);
      if (!cfg.channels.ordersChannel) {
        return error(interaction, 'Not Configured', 'Set the orders channel with /setchannel type:Orders Channel.');
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor('#5865F2');

      if (sticker && sticker.contentType?.startsWith('image/')) {
        embed.setImage(sticker.url);
      }

      const button = new ButtonBuilder()
        .setCustomId('order_create')
        .setLabel('Order')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: 'Order embed sent!', flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('[ORDEREMBED]', err.stack || err.message);
      const msg = err.message || 'Unknown error';
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `Error: ${msg}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.followUp({ content: `Error: ${msg}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
