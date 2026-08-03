require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, MessageFlags } = require('discord.js');
const chalk = require('chalk');
const mongoose = require('mongoose');
const config = require('./config');
const { loadCommands } = require('./handlers/commandHandler');
const { deployCommands } = require('./deploy-commands');

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
  partials: [],
});

// Load slash commands
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
  console.log('');
  console.log(chalk.cyan('╔══════════════════════════════════╗'));
  console.log(chalk.cyan(`║   🤖 Logged in as ${chalk.bold(client.user.tag)}`));
  console.log(chalk.cyan(`║   🌐 Serving ${chalk.bold(client.guilds.cache.size)} guild(s)`));
  console.log(chalk.cyan('║   ⚡ Bot is online & ready!'));
  console.log(chalk.cyan('╚══════════════════════════════════╝'));
  console.log('');

  // Set status
  client.user.setPresence({
    activities: [{ name: `${client.guilds.cache.size} servers | /commands`, type: 3 }], // Watching
    status: 'online',
  });
});

// Slash command handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(chalk.red(`❌ Error executing /${interaction.commandName}:`), error);
    const { buildEmbed } = require('./utils/embed');
    const reply = { embeds: [buildEmbed({ color: 'error', title: '❌ Error', description: 'An unexpected error occurred. Please try again later.' })], flags: MessageFlags.Ephemeral };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Message events (prefix, anti-spam, snipe, sticky)
const {
  messageHandler,
  snipeHandler,
  stickyHandler,
  memberAddHandler,
  channelDeleteHandler,
  roleDeleteHandler,
  banAddHandler,
} = require('./events/messageEvents');

client.on(Events.MessageCreate, messageHandler.execute);
client.on(Events.MessageDelete, snipeHandler.execute);
client.on(Events.MessageCreate, stickyHandler.execute);
client.on(Events.GuildMemberAdd, memberAddHandler.execute);
client.on(Events.ChannelDelete, channelDeleteHandler.execute);
client.on(Events.GuildRoleDelete, roleDeleteHandler.execute);
client.on(Events.GuildBanAdd, banAddHandler.execute);

// Giveaway reaction tracking
const { handleReactionAdd, handleReactionRemove } = require('./handlers/giveawayTracker');
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.partial) {
    try { await reaction.fetch(); } catch (_) { return; }
  }
  await handleReactionAdd(reaction, user);
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (reaction.partial) {
    try { await reaction.fetch(); } catch (_) { return; }
  }
  await handleReactionRemove(reaction, user);
});

// Giveaway auto-end checker (check every 15 seconds)
const Giveaway = require('./models/Giveaway');
const { pickWinners } = require('./utils/giveaway');

setInterval(async () => {
  try {
    const endedGiveaways = await Giveaway.find({ ended: false, endsAt: { $lte: new Date() } });

    for (const giveaway of endedGiveaways) {
      const guild = client.guilds.cache.get(giveaway.guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(giveaway.channelId);
      if (!channel) continue;

      try {
        const msg = await channel.messages.fetch(giveaway.messageId);
        await pickWinners(msg, giveaway);
      } catch (_) {
        giveaway.ended = true;
        giveaway.winnerIds = [];
        await giveaway.save();
      }
    }
  } catch (_) {}
}, 15000);

// ─── Start Bot ─────────────────────────────
async function start() {
  await connectDB();
  // Auto-deploy slash commands on startup
  await deployCommands();
  await client.login(config.token);
}

start();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Shutting down...'));
  await mongoose.disconnect();
  client.destroy();
  process.exit(0);
});
