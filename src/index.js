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
    console.log(chalk.green('✅ Connected to MongoDB'));
  } catch (err) {
    console.error(chalk.red('❌ MongoDB connection error:'), err.message);
    process.exit(1);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(chalk.cyan(`✅ Logged in as ${chalk.bold(client.user.tag)} — ${client.guilds.cache.size} guild(s)`));
  client.user.setPresence({
    activities: [{ name: `${client.guilds.cache.size} server | join our support server`, type: 3 }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('giveaway_enter_')) {
      try {
        const messageId = interaction.customId.replace('giveaway_enter_', '');
        const Giveaway = require('./models/Giveaway');
        const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId, ended: false });

        if (!giveaway) {
          return interaction.reply({ content: '❌ This giveaway has ended or no longer exists.', flags: MessageFlags.Ephemeral });
        }

        if (giveaway.entrants?.includes(interaction.user.id)) {
          return interaction.reply({ content: '⚠️ You\'ve already entered this giveaway!', flags: MessageFlags.Ephemeral });
        }

        giveaway.entrants.push(interaction.user.id);
        await giveaway.save();

        try {
          const msg = await interaction.channel.messages.fetch(messageId);
          const embed = msg.embeds[0];
          if (embed) {
            const newDesc = embed.description
              .replace(/\*\*Participants:\*\* \d+/, `**Participants:** ${giveaway.entrants.length}`);
            await msg.edit({ embeds: [
              require('./utils/embed').buildEmbed({
                color: 'giveaway',
                title: embed.title,
                description: newDesc,
              })
            ]});
          }
        } catch (_) {}

        await interaction.reply({ content: '🎉 **You entered the giveaway!** Good luck!', flags: MessageFlags.Ephemeral });
      } catch (err) {
        console.error('[GIVEAWAY-BUTTON] Error:', err.message);
        if (!interaction.replied) {
          await interaction.reply({ content: '❌ Something went wrong. Try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
    console.error(`❌ /${interaction.commandName}:`, err.message);
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
    console.log(chalk.green('✅ Bot is online!'));

    setInterval(async () => {
      try {
        const Giveaway = require('./models/Giveaway');
        const { pickWinners } = require('./utils/giveaway');
        const expired = await Giveaway.find({ ended: false, endsAt: { $lte: new Date() } });
        for (const gw of expired) {
          try {
            const channel = client.channels.cache.get(gw.channelId);
            if (!channel) continue;
            const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
            if (!msg) continue;
            await pickWinners(msg, gw);
            console.log(`[AUTO-END] Ended giveaway "${gw.prize}" in ${gw.guildId}`);
          } catch (err) {
            console.error('[AUTO-END] Error ending giveaway:', err.message);
          }
        }
      } catch (err) {
        console.error('[AUTO-END] Check error:', err.message);
      }
    }, 30000);
  } catch (err) {
    console.error(chalk.red('❌ Startup failed:'), err.stack || err.message);
    process.exit(1);
  }
})();

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  await mongoose.disconnect();
  client.destroy();
  process.exit(0);
});
