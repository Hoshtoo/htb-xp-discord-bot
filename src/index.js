import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { config } from './config.js';
import { getDb, pruneSnapshots } from './db.js';
import { handleLink } from './commands/link.js';
import { handleUnlink } from './commands/unlink.js';
import { handleSync } from './commands/sync.js';
import { handleLeaderboard } from './commands/leaderboard.js';

getDb();
pruneSnapshots();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

let htbToken;

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'This bot only works inside a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    switch (interaction.commandName) {
      case 'link':
        await handleLink(interaction, htbToken);
        break;
      case 'unlink':
        await handleUnlink(interaction);
        break;
      case 'sync':
        await handleSync(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboard(interaction);
        break;
      default:
        await interaction.reply({
          content: 'Unknown command.',
          flags: MessageFlags.Ephemeral,
        });
    }
  } catch (err) {
    console.error(err);
    const msg = err.message || 'Something went wrong.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg }).catch(() => {});
    } else {
      await interaction
        .reply({ content: msg, flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
});

try {
  htbToken = config.htbToken();
  await client.login(config.discordToken());
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
