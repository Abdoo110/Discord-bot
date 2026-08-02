require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
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
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [],
});

client.commands = loadCommands();

mongoose.set('strictQuery', false);

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log(chalk.green('✅ Connected to MongoDB'));
  } catch (error) {
    console.error(chalk.red('❌ MongoDB connection error:'), error.message);
    process.exit(1);
  }
}

client.once(Events.ClientReady, () => {
  console.log('');
  console.log(chalk.cyan('╔══════════════════════════════════╗'));
  console.log(chalk.cyan(`║   🤖 Logged in as ${chalk.bold(client.user.tag)}`));
  console.log(chalk.cyan(`║   🌐 Serving ${chalk.bold(client.guilds.cache.size)} guild(s)`));
  console.log(chalk.cyan('║   ⚡ Bot is online & ready!'));
  console.log(chalk.cyan('╚══════════════════════════════════╝'));
  console.log('');

  client.user.setPresence({
    activities: [{ name: `${client.guilds.cache.size} servers | /commands`, type: 3 }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(chalk.red(`❌ Error executing /${interaction.commandName}:`), error);
    const { buildEmbed } = require('./utils/embed');
    const reply = { embeds: [buildEmbed({ color: 'error', title: '❌ Error', description: 'An unexpected error occurred. Please try again later.' })], ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

const { messageHandler, snipeHandler, stickyHandler, memberAddHandler, channelDeleteHandler, roleDeleteHandler, banAddHandler } = require('./events/messageEvents');

client.on(Events.MessageCreate, messageHandler.execute);
client.on(Events.MessageDelete, snipeHandler.execute);
client.on(Events.MessageCreate, stickyHandler.execute);
client.on(Events.GuildMemberAdd, memberAddHandler.execute);
client.on(Events.ChannelDelete, channelDeleteHandler.execute);
client.on(Events.GuildRoleDelete, roleDeleteHandler.execute);
client.on(Events.GuildBanAdd, banAddHandler.execute);

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

async function start() {
  await connectDB();
  await deployCommands();
  await client.login(config.token);
}

start();

process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Shutting down...'));
  await mongoose.disconnect();
  client.destroy();
  process.exit(0);
});
