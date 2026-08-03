const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orderembed')
    .setDescription('Create an order embed with stickers and an Order button')
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Embed description (single line)').setRequired(true))
    .addAttachmentOption(o => o.setName('sticker').setDescription('Upload first sticker/image'))
    .addStringOption(o => o.setName('sticker2').setDescription('Second sticker URL (right-click image → Copy Link)'))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (default: current channel)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const desc = interaction.options.getString('description');
    const sticker = interaction.options.getAttachment('sticker');
    const sticker2Url = interaction.options.getString('sticker2');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const cfg = await getConfig(interaction.guild.id);
    if (!cfg.channels.ordersChannel) {
      return error(interaction, 'Not Configured', 'Set the orders channel with /setchannel type:Orders Channel.');
    }

    const button = new ButtonBuilder()
      .setCustomId('order_create')
      .setLabel('Order')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const embeds = [];
    if (sticker && sticker.contentType?.startsWith('image/')) {
      embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setImage(sticker.url).setColor('#5865F2'));
    }
    if (sticker2Url) {
      embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setImage(sticker2Url).setColor('#5865F2'));
    }

    if (embeds.length === 0) {
      embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#5865F2'));
    }

    await channel.send({ embeds, components: [row] });
    await interaction.reply({ content: 'Order embed sent!', flags: MessageFlags.Ephemeral });
  },
};
