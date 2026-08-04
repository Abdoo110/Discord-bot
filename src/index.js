process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] Unhandled Rejection:', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err.stack || err);
});

require('dotenv').config();
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const chalk = require('chalk');
const mongoose = require('mongoose');
const config = require('./config');
const { loadCommands } = require('./handlers/commandHandler');
const { deployCommands } = require('./deploy-commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = loadCommands();

mongoose.set('strictQuery', false);
async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log(chalk.green('Connected to MongoDB'));
  } catch (err) {
    console.error(chalk.red('MongoDB connection error:'), err.message);
    process.exit(1);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(chalk.cyan(`Logged in as ${chalk.bold(client.user.tag)} - ${client.guilds.cache.size} guild(s)`));
  client.user.setPresence({
    activities: [{ name: `${client.guilds.cache.size} server | join our support server`, type: 3 }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() || interaction.isModalSubmit()) {
    const { handleOrderInteraction } = require('./handlers/orderHandler');
    const handled = await handleOrderInteraction(interaction);
    if (handled) return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('giveaway_claim_modal_')) {
    try {
      const messageId = interaction.customId.replace('giveaway_claim_modal_', '');
      const ign = interaction.fields.getTextInputValue('ign');
      const Giveaway = require('./models/Giveaway');
      const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId });

      if (!giveaway || !giveaway.winnerIds?.includes(interaction.user.id)) {
        return interaction.reply({ content: 'Only winners can claim!', flags: MessageFlags.Ephemeral });
      }

      giveaway.claimedBy = giveaway.claimedBy || [];
      giveaway.claimIGNs = giveaway.claimIGNs || new Map();
      giveaway.claimedBy.push(interaction.user.id);
      giveaway.claimIGNs.set(interaction.user.id, ign);
      await giveaway.save();

      await interaction.reply({ content: 'You will be paid soon!', flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('[CLAIM-MODAL]', err.message);
      if (!interaction.replied) await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('giveaway_claim_')) {
      try {
        const messageId = interaction.customId.replace('giveaway_claim_', '');
        const Giveaway = require('./models/Giveaway');
        const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId });

        if (!giveaway || !giveaway.winnerIds?.includes(interaction.user.id)) {
          return interaction.reply({ content: 'Only winners can claim!', flags: MessageFlags.Ephemeral });
        }
        if (giveaway.claimedBy?.includes(interaction.user.id)) {
          return interaction.reply({ content: 'You already claimed this prize!', flags: MessageFlags.Ephemeral });
        }

        if (giveaway.claimTimeMs && giveaway.claimTimeMs > 0) {
          const elapsed = Date.now() - giveaway.endsAt.getTime();
          if (elapsed > giveaway.claimTimeMs) {
            return interaction.reply({ content: 'Claim time has expired!', flags: MessageFlags.Ephemeral });
          }
        }

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder: ARB } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(`giveaway_claim_modal_${messageId}`)
          .setTitle('Claim Your Prize');
        modal.addComponents(
          new ARB().addComponents(
            new TextInputBuilder()
              .setCustomId('ign')
              .setLabel('What is your Minecraft IGN?')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('Enter your in-game name...')
          )
        );
        await interaction.showModal(modal);
      } catch (err) {
        console.error('[CLAIM]', err.message);
        if (!interaction.replied) await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }

    if (interaction.customId.startsWith('giveaway_enter_')) {
      try {
        const messageId = interaction.customId.replace('giveaway_enter_', '');
        const Giveaway = require('./models/Giveaway');

        const updated = await Giveaway.findOneAndUpdate(
          { guildId: interaction.guild.id, messageId, ended: false, entrants: { $ne: interaction.user.id } },
          { $push: { entrants: interaction.user.id } },
          { new: true }
        );

        if (!updated) {
          const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId });
          if (!giveaway || giveaway.ended) {
            return interaction.reply({ content: 'This giveaway has ended or no longer exists.', flags: MessageFlags.Ephemeral });
          }
          return interaction.reply({ content: "You've already entered this giveaway!", flags: MessageFlags.Ephemeral });
        }

        try {
          const msg = await interaction.channel.messages.fetch(messageId);
          const embed = msg.embeds[0];
          if (embed) {
            const newDesc = embed.description
              .replace(/\*\*Participants:\*\* \d+/, `**Participants:** ${updated.entrants.length}`);
            await msg.edit({ embeds: [
              require('./utils/embed').buildEmbed({
                color: 'giveaway',
                title: embed.title,
                description: newDesc,
              })
            ]});
          }
        } catch (_) {}

        await interaction.reply({ content: 'You entered the giveaway! Good luck!', flags: MessageFlags.Ephemeral });
      } catch (err) {
        console.error('[GIVEAWAY-BUTTON] Error:', err.message);
        if (!interaction.replied) {
          await interaction.reply({ content: 'Something went wrong. Try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`/${interaction.commandName}:`, err.message);
    const { buildEmbed } = require('./utils/embed');
    const reply = { embeds: [buildEmbed({ color: 'error', title: 'Error', description: 'Something went wrong.' })], flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
});

const {
  messageHandler, snipeHandler, stickyHandler,
  memberAddHandler, channelDeleteHandler, roleDeleteHandler, banAddHandler,
} = require('./events/messageEvents');

client.on(Events.MessageCreate, messageHandler.execute);
client.on(Events.MessageDelete, snipeHandler.execute);
client.on(Events.MessageCreate, stickyHandler.execute);
client.on(Events.GuildMemberAdd, memberAddHandler.execute);
client.on(Events.ChannelDelete, channelDeleteHandler.execute);
client.on(Events.GuildRoleDelete, roleDeleteHandler.execute);
client.on(Events.GuildBanAdd, banAddHandler.execute);

(async () => {
  try {
    await connectDB();
    await deployCommands();
    await client.login(config.token);
    console.log(chalk.green('Bot is online!'));

    const Giveaway = require('./models/Giveaway');
    const { scheduleEnd, scheduleClaimExpiry } = require('./utils/giveaway');

    const active = await Giveaway.find({ ended: false });
    for (const gw of active) scheduleEnd(client, gw);
    console.log(chalk.cyan(`Scheduled ${active.length} active giveaway(s)`));

    const endedWithClaim = await Giveaway.find({ ended: true, claimTimeMs: { $gt: 0 } });
    for (const gw of endedWithClaim) {
      const elapsed = Date.now() - gw.endsAt.getTime();
      const remaining = gw.claimTimeMs - elapsed;
      if (remaining > 0) {
        scheduleClaimExpiry(client, gw._id, remaining);
      } else {
        try {
          const channel = await client.channels.fetch(gw.channelId).catch(() => null);
          if (channel) {
            const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
            if (msg && msg.embeds[0]) {
              const { EmbedBuilder } = require('discord.js');
              const oldTitle = EmbedBuilder.from(msg.embeds[0]).data.title || '';
              const newTitle = oldTitle.replace(' (ENDED)', ' (CLAIM EXPIRED)');
              if (oldTitle !== newTitle) {
                const emb = EmbedBuilder.from(msg.embeds[0]).setTitle(newTitle);
                await msg.edit({ embeds: [emb], components: [] });
              }
            }
          }
        } catch (_) {}
      }
    }

    setInterval(async () => {
      try {
        const { pickWinners } = require('./utils/giveaway');
        const expired = await Giveaway.find({ ended: false, endsAt: { $lte: new Date() } });
        for (const gw of expired) {
          try {
            const channel = await client.channels.fetch(gw.channelId).catch(() => null);
            if (!channel) continue;
            const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
            if (!msg) continue;
            await pickWinners(msg, gw);
          } catch (err) {
            console.error('[SAFETY] Error:', err.message);
          }
        }
      } catch (err) {
        console.error('[SAFETY] Check error:', err.message);
      }
    }, 120000);
  } catch (err) {
    console.error(chalk.red('Startup failed:'), err.stack || err.message);
    process.exit(1);
  }
})();

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await mongoose.disconnect();
  client.destroy();
  process.exit(0);
});
