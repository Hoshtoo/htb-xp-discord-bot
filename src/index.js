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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

let htbToken;

const DEFER_FIRST_COMMANDS = new Set(['link', 'sync', 'leaderboard']);

/** Interactions where early defer failed (skip handler to avoid double errors). */
const deferFailed = new WeakSet();

client.prependListener(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!DEFER_FIRST_COMMANDS.has(interaction.commandName)) return;
  if (!interaction.inGuild() || interaction.deferred || interaction.replied) return;

  const ageMs = Date.now() - interaction.createdTimestamp;
  try {
    await interaction.deferReply();
  } catch (err) {
    deferFailed.add(interaction);
    console.error(
      `deferReply failed for /${interaction.commandName} (age ${ageMs}ms, code ${err?.code}):`,
      err.message
    );
    if (ageMs > 2500) {
      console.error(
        'Hint: interaction was near the 3s limit — avoid duplicate bot processes or run heavy commands (/leaderboard) right before /link.'
      );
    }
  }
});

client.once(Events.ClientReady, async (c) => {
  await c.guilds.fetch().catch((err) => {
    console.warn('Could not prefetch guilds:', err.message);
  });
  const guildIds = [...c.guilds.cache.keys()];
  console.log(`Logged in as ${c.user.tag} (${c.user.id}) — ${guildIds.length} guild(s)`);
  if (guildIds.length) console.log('Guild IDs:', guildIds.join(', '));
  if (guildIds.length === 0) {
    console.error(
      `WARNING: This bot (${c.user.id}) is not in any server. ` +
        'Server nicknames and member lookups will fail until you invite THIS bot to your Discord server ' +
        '(use the OAuth2 URL from the Developer Portal for this application).'
    );
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (deferFailed.has(interaction)) return;

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
