require('dotenv').config();
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const chalk = require('chalk');
const mongoose = require('mongoose');
const config = require('./config');
const { loadCommands } = require('./handlers/commandHandler');
const { deployCommands } = require('./deploy-commands');

// ─── Crash Protection ──────────────────────
process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('[CRASH] Unhandled Rejection:'), reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.error(chalk.red('[CRASH] Uncaught Exception:'), err.stack || err);
});

// ─── Client Setup ──────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
  makeCache: require('discord.js').Options.cacheWithLimits({
    MessageManager: 50,
    ThreadManager: 0,
    StageInstanceManager: 0,
    GuildEmojiManager: 0,
    GuildStickerManager: 0,
  }),
  sweepers: {
    messages: { interval: 300, lifetime: 600 },
  },
});

client.commands = loadCommands();

// ─── MongoDB Connection ────────────────────
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

// ─── Event Handling ────────────────────────

client.once(Events.ClientReady, async () => {
  console.log(chalk.cyan('╔══════════════════════════════════╗'));
  console.log(chalk.cyan(`║   🤖 Logged in as ${chalk.bold(client.user.tag)}`));
  console.log(chalk.cyan(`║   🌐 Serving ${chalk.bold(client.guilds.cache.size)} guild(s)`));
  console.log(chalk.cyan('║   ⚡ Bot is online & ready!'));
  console.log(chalk.cyan('╚══════════════════════════════════╝'));

  client.user.setPresence({
    activities: [{ name: `${client.guilds.cache.size} server | join our support server`, type: 3 }],
    status: 'online',
  });
});

// Slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(chalk.red(`❌ /${interaction.commandName}:`), error.message);
    const { buildEmbed } = require('./utils/embed');
    const reply = {
      embeds: [buildEmbed({ color: 'error', title: '❌ Error', description: 'Something went wrong.' })],
      flags: MessageFlags.Ephemeral
    };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
});

// Message events (prefix, anti-spam, snipe, sticky, giveaway tracking)
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

// Giveaway auto-end checker (every 30s to reduce load)
const Giveaway = require('./models/Giveaway');
if (Giveaway) {
  setInterval(async () => {
    try {
      const ended = await Giveaway.find({ ended: false, endsAt: { $lte: new Date() } });
      for (const gw of ended) {
        const guild = client.guilds.cache.get(gw.guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.get(gw.channelId);
        if (!channel) continue;
        try {
          const msg = await channel.messages.fetch(gw.messageId);
          const { pickWinners } = require('./utils/giveaway');
          await pickWinners(msg, gw);
        } catch { gw.ended = true; gw.winnerIds = []; await gw.save(); }
      }
    } catch {}
  }, 30000);
}

// ─── Start ─────────────────────────────────
(async () => {
  try {
    await connectDB();
    await deployCommands();
    await client.login(config.token);
  } catch (err) {
    console.error(chalk.red('❌ Startup failed:'), err.message);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('
🛑 Shutting down...'));
  await mongoose.disconnect();
  client.destroy();
  process.exit(0);
});
