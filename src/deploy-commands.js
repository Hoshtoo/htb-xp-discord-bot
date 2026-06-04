import { REST, Routes } from 'discord.js';
import { commandDefinitions } from './commands/definitions.js';
import { config } from './config.js';

const token = config.discordToken();
const rest = new REST({ version: '10' }).setToken(token);

async function main() {
  const app = await rest.get(Routes.oauth2CurrentApplication());
  const appId = app.id;

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(appId, config.guildId), {
      body: commandDefinitions,
    });
    console.log(`Deployed ${commandDefinitions.length} guild commands to ${config.guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(appId), { body: commandDefinitions });
    console.log(`Deployed ${commandDefinitions.length} global commands (may take up to an hour)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
