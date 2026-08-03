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
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ]
});

client.commands = new Collection();

// ─── Database Connection ───────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://abdooessied_db_user:Abdopass123@cluster0.axiocip.mongodb.net/discord-bot?retryWrites=true&w=majority')
  .then(() => console.log(chalk.green('✅ Connected to MongoDB')))
  .catch(err => console.error(chalk.red('❌ MongoDB connection error:'), err));

// ─── Ready Event ───────────────────────────
client.once(Events.ClientReady, async (c) => {
  console.log(chalk.cyan(`🚀 ${c.user.tag} is online!`));

  await loadCommands(client);
  await deployCommands();

  // Load sticky message handler
  require('./handlers/stickyHandler')(client);

  // Load anti-abuse
  require('./handlers/antiAbuse')(client);
});

// ─── Interaction Handler ───────────────────
client.on(Events.InteractionCreate, async interaction => {
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

// ─── Anti-Nuke: Anti-Bot Join ──────────────
client.on(Events.GuildMemberAdd, async member => {
  if (!member.user.bot) return;

  const guildConfig = require('./utils/guildConfig');
  const cfg = await guildConfig.getConfig(member.guild.id);

  if (!cfg.antiNuke?.enabled) return;

  const { EmbedBuilder } = require('discord.js');
  const logChannel = member.guild.channels.cache.get(cfg.channels?.modLogs);
  if (logChannel) {
    logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('Orange')
          .setTitle('⚠️ Suspicious Bot Joined')
          .setDescription(`Bot ${member.user.tag} (${member.id}) joined but no ban/purge action was configured.`)
          .setTimestamp()
      ]
    });
  }
});

// ─── Anti-Spam ────────────────────────────
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  const guildConfig = require('./utils/guildConfig');
  const cfg = await guildConfig.getConfig(message.guild.id);

  if (cfg.antiSpam?.enabled) {
    const { default: AntiSpam } = await import('./handlers/antiSpam.js');
    AntiSpam(message, cfg.antiSpam);
  }
});

client.login(process.env.DISCORD_TOKEN);
