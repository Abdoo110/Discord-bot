const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const { buildEmbed } = require('../utils/embed');
const { calculatePrice } = require('../utils/orderPricing');
const Order = require('../models/Order');
const GuildConfig = require('../models/GuildConfig');

async function handleOrderInteraction(interaction) {
  try {
    if (interaction.isButton() && interaction.customId === 'order_create') {
      await showOrderModal(interaction);
      return true;
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('order_modal_')) {
      await processOrder(interaction);
      return true;
    }
    if (interaction.isButton() && interaction.customId.startsWith('order_confirm_')) {
      await confirmOrder(interaction);
      return true;
    }
    if (interaction.isButton() && interaction.customId.startsWith('order_ready_')) {
      await userReady(interaction);
      return true;
    }
  } catch (err) {
    console.error('[ORDER] Error:', err.stack || err.message);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral });
      }
    } catch (_) {}
  }
  return false;
}

async function showOrderModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`order_modal_${interaction.user.id}_${interaction.guild.id}`)
    .setTitle('Place Your Order');

  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('shulker_type').setLabel('What type of shulker are you interested in?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 1 or 2')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantity').setLabel('How many do you need?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 1, 2, or "two"')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('when_needed').setLabel('When are you looking to get those?').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('e.g. Tomorrow, next week, ASAP...')),
  );

  await interaction.showModal(modal);
}

async function processOrder(interaction) {
  const shulkerType = interaction.fields.getTextInputValue('shulker_type');
  const qtyRaw = interaction.fields.getTextInputValue('quantity');
  const whenNeeded = interaction.fields.getTextInputValue('when_needed');

  const { total, formatted, quantity } = calculatePrice(shulkerType, qtyRaw);

  if (total === 0 || isNaN(quantity)) {
    return interaction.reply({ content: 'Could not calculate price. Make sure you entered a valid shulker type (1 or 2) and quantity.', flags: MessageFlags.Ephemeral });
  }

  const order = await Order.create({
    guildId: interaction.guild.id, userId: interaction.user.id, username: interaction.user.tag,
    shulkerType, quantity, whenNeeded, totalPrice: total, formattedPrice: formatted, status: 'pending',
  });

  try {
    const dmChannel = await interaction.user.createDM();
    await dmChannel.send({ embeds: [
      new EmbedBuilder().setTitle('Order Placed').setDescription(`**Status:** Pending\n*You need to wait until your order is accepted.*\n\n**Shulker Type:** ${shulkerType}\n**Quantity:** ${quantity}\n**Total Price:** ${formatted}\n**When:** ${whenNeeded}`).setColor('#5865F2').setTimestamp(),
    ]});
  } catch (_) {
    return interaction.reply({ content: 'I could not DM you. Please open your DMs and try again.', flags: MessageFlags.Ephemeral });
  }

  const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });
  const ordersChannelId = cfg?.channels?.ordersChannel;
  if (!ordersChannelId) {
    await interaction.reply({ content: 'Order saved but no orders channel configured.', flags: MessageFlags.Ephemeral });
    return;
  }

  const ordersChannel = interaction.guild.channels.cache.get(ordersChannelId);
  if (!ordersChannel) {
    await interaction.reply({ content: 'Order saved but orders channel not found.', flags: MessageFlags.Ephemeral });
    return;
  }

  const orderEmbed = new EmbedBuilder()
    .setTitle(`New Order — ${interaction.user.tag}`)
    .setDescription(`**Shulker Type:** ${shulkerType}\n**Quantity:** ${quantity}\n**When Needed:** ${whenNeeded}\n**Total Price:** ${formatted}`)
    .setColor('#5865F2').setFooter({ text: `Order ID: ${order._id} | Status: Pending` }).setTimestamp();

  const confirmBtn = new ButtonBuilder().setCustomId(`order_confirm_${order._id}`).setLabel(`Confirm Order — ${formatted}`).setStyle(ButtonStyle.Success);
  const readyBtn = new ButtonBuilder().setCustomId(`order_ready_${order._id}`).setLabel('User is Ready').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(confirmBtn, readyBtn);

  const sent = await ordersChannel.send({ embeds: [orderEmbed], components: [row] });

  order.orderChannelId = ordersChannelId;
  order.orderMessageId = sent.id;
  await order.save();

  await interaction.reply({ content: `Your order has been placed! Total: **${formatted}**. Check your DMs.`, flags: MessageFlags.Ephemeral });
}

async function confirmOrder(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
    return interaction.reply({ content: 'You do not have permission.', flags: MessageFlags.Ephemeral });
  }

  const orderId = interaction.customId.replace('order_confirm_', '');
  const order = await Order.findById(orderId);
  if (!order) return interaction.reply({ content: 'Order not found.', flags: MessageFlags.Ephemeral });
  if (order.status !== 'pending') return interaction.reply({ content: `Order is already **${order.status}**.`, flags: MessageFlags.Ephemeral });

  order.status = 'processing';
  await order.save();

  try {
    const user = await interaction.client.users.fetch(order.userId);
    const dm = await user.createDM();
    await dm.send({ embeds: [new EmbedBuilder().setTitle('Order Processing').setDescription(`Your order is getting processed, please wait.\n\n**Shulker Type:** ${order.shulkerType}\n**Quantity:** ${order.quantity}\n**Total Price:** ${order.formattedPrice}`).setColor('#FEE75C').setTimestamp()] });
  } catch (_) {}

  try {
    const channel = interaction.guild.channels.cache.get(order.orderChannelId);
    if (channel) {
      const msg = await channel.messages.fetch(order.orderMessageId).catch(() => null);
      if (msg) {
        const emb = EmbedBuilder.from(msg.embeds[0]).setFooter({ text: `Order ID: ${order._id} | Status: Processing` }).setColor('#FEE75C');
        const confirmBtn = new ButtonBuilder().setCustomId(`order_confirm_${order._id}`).setLabel(`Confirm Order — ${order.formattedPrice}`).setStyle(ButtonStyle.Success).setDisabled(true);
        const readyBtn = new ButtonBuilder().setCustomId(`order_ready_${order._id}`).setLabel('User is Ready').setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(confirmBtn, readyBtn);
        await msg.edit({ embeds: [emb], components: [row] });
      }
    }
  } catch (_) {}

  await interaction.reply({ content: 'Order confirmed — user has been DMed.', flags: MessageFlags.Ephemeral });
}

async function userReady(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
    return interaction.reply({ content: 'You do not have permission.', flags: MessageFlags.Ephemeral });
  }

  const orderId = interaction.customId.replace('order_ready_', '');
  const order = await Order.findById(orderId);
  if (!order) return interaction.reply({ content: 'Order not found.', flags: MessageFlags.Ephemeral });
  if (order.status === 'ready') return interaction.reply({ content: 'Order is already marked as ready.', flags: MessageFlags.Ephemeral });

  order.status = 'ready';
  await order.save();

  try {
    const channel = interaction.guild.channels.cache.get(order.orderChannelId);
    if (channel) {
      const msg = await channel.messages.fetch(order.orderMessageId).catch(() => null);
      if (msg) {
        const emb = EmbedBuilder.from(msg.embeds[0]).setFooter({ text: `Order ID: ${order._id} | Status: Ready` }).setColor('#57F287');
        await msg.edit({ embeds: [emb], components: [] });
      }
    }
  } catch (_) {}

  try {
    const user = await interaction.client.users.fetch(order.userId);
    const dm = await user.createDM();
    await dm.send({ embeds: [new EmbedBuilder().setTitle('Your Order is Ready!').setDescription(`Hello ${user.username}, your order is ready!\nWhen are you free today?\n\n**Reply to this message** with when you can log on.\n\n**Shulker Type:** ${order.shulkerType}\n**Quantity:** ${order.quantity}\n**Total Price:** ${order.formattedPrice}`).setColor('#57F287').setTimestamp()] });

    const filter = m => m.author.id === order.userId && !m.author.bot;
    const collector = dm.createMessageCollector({ filter, max: 1, time: 86400000 });

    collector.on('collect', async (msg) => {
      try {
        const ordersChannel = interaction.guild.channels.cache.get(order.orderChannelId);
        if (ordersChannel) {
          await ordersChannel.send({ embeds: [new EmbedBuilder().setTitle(`${user.username} is available`).setDescription(msg.content).setFooter({ text: `Order ID: ${order._id}` }).setColor('#5865F2').setTimestamp()] });
        }
        await dm.send('Your availability has been sent!');
      } catch (_) {}
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        dm.send('No reply received — contact staff directly.').catch(() => {});
      }
    });
  } catch (_) {}

  await interaction.reply({ content: 'User has been DMed and is awaiting their response.', flags: MessageFlags.Ephemeral });
}

module.exports = { handleOrderInteraction };
