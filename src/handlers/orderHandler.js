const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { calculatePrice } = require('../utils/orderPricing');
const Order = require('../models/Order');
const GuildConfig = require('../models/GuildConfig');

async function handleOrderInteraction(interaction) {
  try {
    if (interaction.isModalSubmit() && interaction.customId.startsWith('order_modal_msg_')) { await handleMessageSubmit(interaction); return true; }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('order_modal_')) { await processOrder(interaction); return true; }
    if (interaction.isButton() && interaction.customId === 'order_create') { await showOrderModal(interaction); return true; }
    if (interaction.isButton() && interaction.customId.startsWith('order_confirm_')) { await confirmOrder(interaction); return true; }
    if (interaction.isButton() && interaction.customId.startsWith('order_ready_')) { await userReady(interaction); return true; }
    if (interaction.isButton() && interaction.customId.startsWith('order_msg_S_')) { await openMessageModal(interaction, 'staff'); return true; }
    if (interaction.isButton() && interaction.customId.startsWith('order_msg_U_')) { await openMessageModal(interaction, 'user'); return true; }
    if (interaction.isButton() && interaction.customId.startsWith('order_done_S_')) { await completeOrder(interaction, 'staff'); return true; }
    if (interaction.isButton() && interaction.customId.startsWith('order_done_U_')) { await completeOrder(interaction, 'user'); return true; }
  } catch (err) {
    console.error('[ORDER]', err.stack || err.message || err);
    const msg = err.message || String(err);
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `Error: ${msg}`, flags: MessageFlags.Ephemeral }).catch(() => {});
      else await interaction.reply({ content: `Error: ${msg}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    } catch (_) {}
  }
  return false;
}

async function showOrderModal(interaction) {
  const modal = new ModalBuilder().setCustomId(`order_modal_${interaction.user.id}_${interaction.guild.id}`).setTitle('Place Your Order');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('shulker_type').setLabel('What type of shulker?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 1 or 2')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantity').setLabel('How many?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 1, 2, or "two"')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('when_needed').setLabel('When?').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('e.g. Tomorrow, next week, ASAP...')),
  );
  await interaction.showModal(modal);
}

async function processOrder(interaction) {
  const shulkerType = interaction.fields.getTextInputValue('shulker_type');
  const qtyRaw = interaction.fields.getTextInputValue('quantity');
  const whenNeeded = interaction.fields.getTextInputValue('when_needed');
  const { total, formatted, quantity } = calculatePrice(shulkerType, qtyRaw);
  if (total === 0 || isNaN(quantity)) return interaction.reply({ content: 'Could not calculate price. Make sure shulker type is 1 or 2 and quantity is valid.', flags: MessageFlags.Ephemeral });

  const order = await Order.create({ guildId: interaction.guild.id, userId: interaction.user.id, username: interaction.user.tag, shulkerType, quantity, whenNeeded, totalPrice: total, formattedPrice: formatted, status: 'pending' });

  try { const dm = await interaction.user.createDM(); await dm.send({ embeds: [new EmbedBuilder().setTitle('Order Placed').setDescription(`**Status:** Pending - wait for acceptance.\n\n**Shulker Type:** ${shulkerType}\n**Quantity:** ${quantity}\n**Total Price:** ${formatted}\n**When:** ${whenNeeded}`).setColor('#5865F2').setTimestamp()] }); }
  catch (_) { return interaction.reply({ content: 'I could not DM you. Please open your DMs and try again.', flags: MessageFlags.Ephemeral }); }

  const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });
  const ordersChannelId = cfg?.channels?.ordersChannel;
  if (!ordersChannelId) { await interaction.reply({ content: 'Order saved but no orders channel configured.', flags: MessageFlags.Ephemeral }); return; }
  const ordersChannel = interaction.guild.channels.cache.get(ordersChannelId);
  if (!ordersChannel) { await interaction.reply({ content: 'Order saved but orders channel not found.', flags: MessageFlags.Ephemeral }); return; }

  const orderEmbed = new EmbedBuilder().setTitle(`New Order - ${interaction.user.tag}`).setDescription(`**Shulker Type:** ${shulkerType}\n**Quantity:** ${quantity}\n**When Needed:** ${whenNeeded}\n**Total Price:** ${formatted}`).setColor('#5865F2').setFooter({ text: `Order ID: ${order._id} | Status: Pending` }).setTimestamp();
  const confirmBtn = new ButtonBuilder().setCustomId(`order_confirm_${order._id}`).setLabel(`Confirm Order - ${formatted}`).setStyle(ButtonStyle.Success);
  const readyBtn = new ButtonBuilder().setCustomId(`order_ready_${order._id}`).setLabel('User is Ready').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(confirmBtn, readyBtn);
  const sent = await ordersChannel.send({ embeds: [orderEmbed], components: [row] });
  order.orderChannelId = ordersChannelId; order.orderMessageId = sent.id; await order.save();
  await interaction.reply({ content: `Order placed! Total: **${formatted}**. Check your DMs.`, flags: MessageFlags.Ephemeral });
}

async function confirmOrder(interaction) {
  if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageEvents)) return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
  const orderId = interaction.customId.slice('order_confirm_'.length);
  const order = await Order.findById(orderId);
  if (!order) return interaction.reply({ content: 'Order not found.', flags: MessageFlags.Ephemeral });
  if (order.status !== 'pending') return interaction.reply({ content: `Order is already **${order.status}**.`, flags: MessageFlags.Ephemeral });
  order.status = 'processing'; await order.save();

  try { const user = await interaction.client.users.fetch(order.userId); await user.send({ embeds: [new EmbedBuilder().setTitle('Order Processing').setDescription(`Your order is now being processed.\n\n**Shulker Type:** ${order.shulkerType}\n**Quantity:** ${order.quantity}\n**Total Price:** ${order.formattedPrice}`).setColor('#FEE75C').setTimestamp()] }); } catch (_) {}

  try {
    const channel = interaction.guild.channels.cache.get(order.orderChannelId);
    if (channel) { const msg = await channel.messages.fetch(order.orderMessageId).catch(() => null);
      if (msg) { const emb = EmbedBuilder.from(msg.embeds[0]).setFooter({ text: `Order ID: ${order._id} | Status: Processing` }).setColor('#FEE75C');
        const pb = new ButtonBuilder().setCustomId('order_processing').setLabel('Processing...').setStyle(ButtonStyle.Secondary).setDisabled(true);
        const rb = new ButtonBuilder().setCustomId(`order_ready_${order._id}`).setLabel('User is Ready').setStyle(ButtonStyle.Primary);
        const db = new ButtonBuilder().setCustomId(`order_done_S_${order._id}`).setLabel('Order Successful').setStyle(ButtonStyle.Success);
        await msg.edit({ embeds: [emb], components: [new ActionRowBuilder().addComponents(pb, rb, db)] }); }
    }
  } catch (_) {}

  await interaction.reply({ content: 'Order confirmed - user DMed.', flags: MessageFlags.Ephemeral });
}

async function userReady(interaction) {
  if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageEvents)) return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
  const orderId = interaction.customId.slice('order_ready_'.length);
  const order = await Order.findById(orderId);
  if (!order) return interaction.reply({ content: 'Order not found.', flags: MessageFlags.Ephemeral });
  if (order.status === 'ready') return interaction.reply({ content: 'Already marked as ready.', flags: MessageFlags.Ephemeral });
  order.status = 'ready'; await order.save();

  try {
    const channel = interaction.guild.channels.cache.get(order.orderChannelId);
    if (channel) { const msg = await channel.messages.fetch(order.orderMessageId).catch(() => null);
      if (msg) { const emb = EmbedBuilder.from(msg.embeds[0]).setFooter({ text: `Order ID: ${order._id} | Status: Ready` }).setColor('#57F287');
        const sm = new ButtonBuilder().setCustomId(`order_msg_S_${order._id}`).setLabel('Send Message').setStyle(ButtonStyle.Primary);
        const os = new ButtonBuilder().setCustomId(`order_done_S_${order._id}`).setLabel('Order Successful').setStyle(ButtonStyle.Success);
        await msg.edit({ embeds: [emb], components: [new ActionRowBuilder().addComponents(sm, os)] }); }
    }
  } catch (_) {}

  try {
    const user = await interaction.client.users.fetch(order.userId); const dm = await user.createDM();
    const dmEmbed = new EmbedBuilder().setTitle('Your Order is Ready!').setDescription(`**Shulker Type:** ${order.shulkerType}\n**Quantity:** ${order.quantity}\n**Total Price:** ${order.formattedPrice}\n\nUse the buttons below to chat or confirm.`).setColor('#57F287').setTimestamp();
    const sm = new ButtonBuilder().setCustomId(`order_msg_U_${order._id}`).setLabel('Send Message').setStyle(ButtonStyle.Primary);
    const cf = new ButtonBuilder().setCustomId(`order_done_U_${order._id}`).setLabel('Confirm Finished').setStyle(ButtonStyle.Success);
    await dm.send({ embeds: [dmEmbed], components: [new ActionRowBuilder().addComponents(sm, cf)] });
  } catch (_) {}

  await interaction.reply({ content: 'User DMed with messaging & confirmation buttons.', flags: MessageFlags.Ephemeral });
}

async function openMessageModal(interaction, sender) {
  const prefix = sender === 'staff' ? 'order_msg_S_' : 'order_msg_U_';
  const orderId = interaction.customId.slice(prefix.length);
  const modal = new ModalBuilder().setCustomId(`order_modal_msg_${sender}_${orderId}`).setTitle(sender === 'staff' ? 'Message to User' : 'Message to Staff');
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message').setLabel('Type your message').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Enter your message here...')));
  await interaction.showModal(modal);
}

async function handleMessageSubmit(interaction) {
  const parts = interaction.customId.split('_'); const sender = parts[3]; const orderId = parts.slice(4).join('_');
  const message = interaction.fields.getTextInputValue('message');
  const order = await Order.findById(orderId);
  if (!order) return interaction.reply({ content: 'Order not found.', flags: MessageFlags.Ephemeral });

  const guild = interaction.guild || await interaction.client.guilds.fetch(order.guildId).catch(() => null);
  if (!guild) return interaction.reply({ content: 'Guild not found.', flags: MessageFlags.Ephemeral });
  const channel = guild.channels.cache.get(order.orderChannelId);
  if (!channel) return interaction.reply({ content: 'Orders channel not found.', flags: MessageFlags.Ephemeral });
  const orderMsg = await channel.messages.fetch(order.orderMessageId).catch(() => null);
  if (!orderMsg) return interaction.reply({ content: 'Order message not found.', flags: MessageFlags.Ephemeral });
  if (!orderMsg.embeds[0]) return interaction.reply({ content: 'Embed missing from message.', flags: MessageFlags.Ephemeral });

  const oldDesc = EmbedBuilder.from(orderMsg.embeds[0]).data.description || '';
  const label = sender === 'staff' ? '\n**Staff:**' : `\n**${interaction.user.username}:**`;
  const newEmbed = EmbedBuilder.from(orderMsg.embeds[0]).setDescription(oldDesc + `${label} ${message}`);
  await orderMsg.edit({ embeds: [newEmbed], components: orderMsg.components });

  if (sender === 'staff') { try { const user = await interaction.client.users.fetch(order.userId); await user.send(`**Staff:** ${message}`); } catch (_) {} }
  await interaction.reply({ content: 'Message sent!', flags: MessageFlags.Ephemeral });
}

async function completeOrder(interaction, who) {
  const prefix = who === 'staff' ? 'order_done_S_' : 'order_done_U_';
  const orderId = interaction.customId.slice(prefix.length);
  const order = await Order.findById(orderId);
  if (!order) return interaction.reply({ content: 'Order not found.', flags: MessageFlags.Ephemeral });
  if (order.status === 'completed') return interaction.reply({ content: 'Already completed.', flags: MessageFlags.Ephemeral });
  order.status = 'completed'; await order.save();

  const guild = interaction.guild || await interaction.client.guilds.fetch(order.guildId).catch(() => null);
  if (guild) {
    const channel = guild.channels.cache.get(order.orderChannelId);
    if (channel) { const msg = await channel.messages.fetch(order.orderMessageId).catch(() => null);
      if (msg && msg.embeds[0]) { const oldDesc = EmbedBuilder.from(msg.embeds[0]).data.description || ''; const whoLabel = who === 'staff' ? 'Staff' : interaction.user.username;
        const emb = EmbedBuilder.from(msg.embeds[0]).setDescription(oldDesc + `\n\n**Completed by ${whoLabel}**`).setFooter({ text: `Order ID: ${order._id} | Status: Completed` }).setColor('#57F287');
        await msg.edit({ embeds: [emb], components: [] }); }
    }
  }

  if (who === 'staff') { try { const user = await interaction.client.users.fetch(order.userId); await user.send('Your order has been completed! Thank you!'); } catch (_) {} }
  else { if (guild) { const channel = guild.channels.cache.get(order.orderChannelId); if (channel) await channel.send({ content: `**${interaction.user.username}** confirmed the order is finished.` }); } }
  await interaction.reply({ content: 'Order marked as complete!', flags: MessageFlags.Ephemeral });
}

module.exports = { handleOrderInteraction };
