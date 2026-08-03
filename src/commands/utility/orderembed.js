const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { error } = require('../../utils/embed');
const { getConfig } = require('../../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orderembed')
    .setDescription('Create an order embed with stickers and an Order button')
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Embed description (single line)').setRequired(true))
    .addStringOption(o => o.setName('sticker').setDescription('First sticker URL (right-click image → Copy Link)'))
    .addStringOption(o => o.setName('sticker2').setDescription('Second sticker URL (right-click image → Copy Link)'))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (default: current channel)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const s1 = interaction.options.getString('sticker');
      const s2 = interaction.options.getString('sticker2');
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
      if (s1) embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setImage(s1).setColor('#5865F2'));
      if (s2) embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setImage(s2).setColor('#5865F2'));
      if (embeds.length === 0) embeds.push(new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#5865F2'));

      await channel.send({ embeds, components: [row] });
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
