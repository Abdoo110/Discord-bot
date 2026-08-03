const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orderembed')
    .setDescription('Create an order embed with stickers and an Order button')
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Embed description (single line)').setRequired(true))
    .addAttachmentOption(o => o.setName('sticker').setDescription('First sticker/image'))
    .addAttachmentOption(o => o.setName('sticker2').setDescription('Second sticker/image'))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (default: current channel)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const desc = interaction.options.getString('description');
    const sticker = interaction.options.getAttachment('sticker');
    const sticker2 = interaction.options.getAttachment('sticker2');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const cfg = await getConfig(interaction.guild.id);
    if (!cfg.channels.ordersChannel) {
      return error(interaction, 'Not Configured', 'Set the orders channel with /setchannel type:Orders Channel.');
    }

    const embeds = [];

    if (sticker && sticker2 && sticker.contentType?.startsWith('image/') && sticker2.contentType?.startsWith('image/')) {
      embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#5865F2').setImage(sticker.url));
      embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#5865F2').setImage(sticker2.url));
    } else if (sticker && sticker.contentType?.startsWith('image/')) {
      embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#5865F2').setImage(sticker.url));
    } else if (sticker2 && sticker2.contentType?.startsWith('image/')) {
      embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#5865F2').setImage(sticker2.url));
    } else {
      embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#5865F2'));
    }

    const button = new ButtonBuilder()
      .setCustomId('order_create')
      .setLabel('Order')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({ embeds, components: [row] });
    await interaction.reply({ content: 'Order embed sent!', flags: MessageFlags.Ephemeral });
  },
};
