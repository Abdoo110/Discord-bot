// ─── CRASH PROTECTION ──────────────────────
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

// ─── Client ────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = loadCommands();

// ─── MongoDB ───────────────────────────────
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

// ─── Events ────────────────────────────────

client.once(Events.ClientReady, async () => {
  console.log(chalk.cyan(`✅ Logged in as ${chalk.bold(client.user.tag)} — ${client.guilds.cache.size} guild(s)`));
  client.user.setPresence({
    activities: [{ name: `${client.guilds.cache.size} server | join our support server`, type: 3 }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
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

// Message events (anti-spam, prefix, snipe, sticky, giveaway tracking)
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

// ─── Start ─────────────────────────────────
(async () => {
  try {
    await connectDB();
    await deployCommands();
    await client.login(config.token);
    console.log(chalk.green('✅ Bot is online!'));
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
