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
const Staff = require('./models/Staff');
const config = require('./config');

// ─── Startup guard: fail fast with a clear message if env vars are missing ───
const missing = [];
if (!config.token || typeof config.token !== 'string' || config.token.trim() === '') missing.push('TOKEN');
if (!config.clientId || typeof config.clientId !== 'string' || config.clientId.trim() === '') missing.push('CLIENT_ID');
if (!config.mongoUri || typeof config.mongoUri !== 'string' || config.mongoUri.trim() === '') missing.push('MONGODB_URI');
if (missing.length > 0) {
  console.error('');
  console.error(chalk.red.bold('❌ Missing environment variable(s): ' + missing.join(', ')));
  console.error(chalk.red('   The bot cannot start without these.'));
  console.error('');
  console.error('   👉 To fix: In Railway, open your service → Variables, then set:');
  console.error('      • TOKEN        — your Discord bot token (Developer Portal → Bot → Token)');
  console.error('      • CLIENT_ID    — your Discord Application ID (Developer Portal → General Information)');
  console.error('      • MONGODB_URI  — your MongoDB Atlas connection string');
  console.error('');
  console.error('   After adding them, Railway will redeploy automatically.');
  console.error('   TIP: NEVER paste your token in chat or code — only in Railway Variables.');
  console.error('');
  process.exit(1);
}
if (config.token.includes(' ') || config.token.includes('\n') || config.token.includes('\r')) {
  console.error(chalk.red.bold('❌ TOKEN looks malformed (contains spaces/newlines).'));
  console.error(chalk.red('   Check the Railway variable for accidental whitespace or quotes.'));
  process.exit(1);
}

const { loadCommands } = require('./handlers/commandHandler');
const { deployCommands } = require('./deploy-commands');
const { getConfig } = require('./utils/guildConfig');
const { hasCommandAccess, COMMAND_PERMISSIONS } = require('./utils/permissions');

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

    // Migrate the old global userId index to a guild-scoped staff index.
    const indexes = await Staff.collection.indexes();
    const legacyUserIndex = indexes.find(index => index.unique && index.key?.userId === 1 && !index.key?.guildId);
    if (legacyUserIndex?.name) {
      await Staff.collection.dropIndex(legacyUserIndex.name);
    }
    await Staff.syncIndexes();

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

  // === GIVEAWAY CLAIM MODAL SUBMIT ===
  if (interaction.isModalSubmit() && interaction.customId.startsWith('giveaway_claim_modal_')) {
    try {
      const messageId = interaction.customId.replace('giveaway_claim_modal_', '');
      const ign = interaction.fields.getTextInputValue('ign');
      const Giveaway = require('./models/Giveaway');
      const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId });

      if (!giveaway || !giveaway.winnerIds?.includes(interaction.user.id)) {
        return interaction.reply({ content: 'Only winners can claim!', flags: MessageFlags.Ephemeral });
      }

      if (giveaway.claimTimeMs && giveaway.claimTimeMs > 0) {
        const elapsed = Date.now() - giveaway.endsAt.getTime();
        if (elapsed > giveaway.claimTimeMs) {
          return interaction.reply({ content: 'Claim time has expired!', flags: MessageFlags.Ephemeral });
        }
      }

      giveaway.claimedBy = giveaway.claimedBy || [];
      giveaway.claimIGNs = giveaway.claimIGNs || new Map();
      giveaway.claimedBy.push(interaction.user.id);
      giveaway.claimIGNs.set(interaction.user.id, ign);
      await giveaway.save();

      try {
        const GuildConfig = require('./models/GuildConfig');
        const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (cfg?.channels?.claimIGNsChannel) {
          const logChannel = interaction.guild.channels.cache.get(cfg.channels.claimIGNsChannel);
          if (logChannel) {
            const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder: ARB2 } = require('discord.js');
            const prizeValueText = giveaway.prizeValue && giveaway.prizeValue > 0
              ? giveaway.prizeValue.toLocaleString()
              : 'Not set';
            const paidBtn = new ButtonBuilder()
              .setCustomId(`giveaway_paid_${messageId}_${interaction.user.id}`)
              .setLabel('💰 Mark as Paid')
              .setStyle(ButtonStyle.Success);
            const paidRow = new ARB2().addComponents(paidBtn);
            await logChannel.send({ embeds: [new EmbedBuilder()
              .setTitle('🏆 Prize Claimed')
              .addFields(
                { name: '🎁 Prize', value: giveaway.prize, inline: true },
                { name: '💵 Amount to Pay', value: prizeValueText, inline: true },
                { name: '👤 Winner', value: `<@${interaction.user.id}>`, inline: true },
                { name: '🎮 IGN', value: ign, inline: true },
                { name: '⏰ Claimed', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
              )
              .setColor('#57F287')
              .setFooter({ text: 'Click Paid after sending the prize' })
              .setTimestamp()
            ], components: [paidRow] });
          }
        }
      } catch (_) {}

      await interaction.reply({ content: 'You will be paid soon!', flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('[CLAIM-MODAL]', err.message);
      if (!interaction.replied) await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return;
  }

  // === GIVEAWAY BUTTONS ===
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('giveaway_paid_')) {
      try {
        const parts = interaction.customId.replace('giveaway_paid_', '').split('_');
        const messageId = parts[0];
        const winnerId = parts.slice(1).join('_');

        const Giveaway = require('./models/Giveaway');
        const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId });

        if (!giveaway || interaction.user.id !== giveaway.hostId) {
          return interaction.reply({ content: 'Only the giveaway host can mark as paid!', flags: MessageFlags.Ephemeral });
        }

        try {
          const member = await interaction.guild.members.fetch(winnerId).catch(() => null);
          if (member) {
            const GuildConfig = require('./models/GuildConfig');
            const cfg = await GuildConfig.findOne({ guildId: interaction.guild.id });
            const voucherLine = cfg?.channels?.vouchLogs
              ? `📜 **Vouch for us:** Use \`/vouch\` in <#${cfg.channels.vouchLogs}>`
              : '📜 **Vouch for us:** Use `/vouch` in the server';
            const proofLine = cfg?.channels?.giveawayProofChannel
              ? `📸 **Check giveaway proof in:** <#${cfg.channels.giveawayProofChannel}>`
              : '📸 Check giveaway proof in the server';
            const amountLine = giveaway.prizeValue && giveaway.prizeValue > 0
              ? `💰 **Amount Paid:** ${giveaway.prizeValue.toLocaleString()}`
              : '';
            const { EmbedBuilder } = require('discord.js');
            await member.send({ embeds: [new EmbedBuilder()
              .setTitle('✅ You Have Been Paid!')
              .setDescription([
                `You have been paid for **${giveaway.prize}**!`,
                amountLine,
                '',
                proofLine,
                voucherLine,
              ].filter(Boolean).join('\n'))
              .setColor('#57F287')
              .setTimestamp()
            ]});
          }
        } catch (_) {}

        if (interaction.message.embeds[0]) {
          const { EmbedBuilder } = require('discord.js');
          const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
          oldEmbed.setTitle('🏆 Prize Claimed (PAID)').setColor('#FEE75C').setFooter({ text: `Paid by ${interaction.user.tag}` });
          await interaction.message.edit({ embeds: [oldEmbed], components: [] });
        }

        await interaction.reply({ content: '✅ Marked as paid! Winner has been DMed.', flags: MessageFlags.Ephemeral });
      } catch (err) {
        console.error('[PAID]', err.message);
        if (!interaction.replied) await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }

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

  if (COMMAND_PERMISSIONS[interaction.commandName]) {
    const guildConfig = await getConfig(interaction.guild.id);
    if (!hasCommandAccess(interaction.member, guildConfig, interaction.commandName)) {
      const { buildEmbed } = require('./utils/embed');
      return interaction.reply({ embeds: [buildEmbed({
        color: 'error',
        title: '⛔ Command Restricted',
        description: 'Only the server owner or a role configured with /owner can use /' + interaction.commandName + '.',
      })], flags: MessageFlags.Ephemeral });
    }
  }

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
        scheduleClaimExpiry(client, gw._id, remaining, gw.claimMessageId);
      } else {
        try {
          const channel = await client.channels.fetch(gw.channelId).catch(() => null);
          if (channel) {
            const msgId = gw.claimMessageId || gw.messageId;
            const msg = await channel.messages.fetch(msgId).catch(() => null);
            if (msg && msg.embeds[0]) {
              const { EmbedBuilder } = require('discord.js');
              const oldTitle = EmbedBuilder.from(msg.embeds[0]).data.title || '';
              const newTitle = oldTitle.replace(' (ENDED)', '').replace(' (CLAIM EXPIRED)', '') + ' (CLAIM EXPIRED)';
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
