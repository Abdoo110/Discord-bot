const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Load all slash commands from the commands directory and return a Collection.
 */
function loadCommands() {
  const commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        commands.set(command.data.name, command);
        console.log(`  ✅ Loaded command: /${command.data.name}`);
      } else {
        console.warn(`  ⚠️ Skipping ${filePath} — missing "data" or "execute"`);
      }
    }
  }

  return commands;
}

module.exports = { loadCommands };
