import { Client, EmbedBuilder, GatewayIntentBits } from 'discord.js';
import { SHOWCASE_GUILD_ID } from './fixtures.js';
import { prepareShowcaseDatabase } from './prepare-showcase-db.js';
import { buildNotificationPreviews } from './build-showcase-page.js';
import { buildAllShowcaseLeaderboards } from './leaderboard-from-db.js';

const DEFAULT_POST_DELAY_MS = 450;

/**
 * @param {string} name
 */
function requireEnv(name) {
 const value = process.env[name]?.trim();
 if (!value) {
  throw new Error(
   `Missing ${name}. Add it to .env — see docs/SHOWCASE_DISCORD.md for setup.`
  );
 }
 return value;
}

/**
 * Read the Discord test server + channel targets from the environment.
 */
export function getDiscordTestConfig() {
 return {
  token: requireEnv('DISCORD_TOKEN'),
  guildId: requireEnv('TEST_GUILD_ID'),
  channelId: requireEnv('TEST_CHANNEL_ID'),
 };
}

function sleep(ms) {
 return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {import('discord.js').TextBasedChannel} channel
 */
function assertSendableChannel(channel, expectedGuildId) {
 if (!channel || typeof channel.send !== 'function') {
  throw new Error(`Channel is missing or does not support sending messages.`);
 }
 if (channel.guildId && channel.guildId !== expectedGuildId) {
  throw new Error(
   `TEST_CHANNEL_ID belongs to guild ${channel.guildId}, but TEST_GUILD_ID is ${expectedGuildId}.`
  );
 }
}

/**
 * Post showcase notification embeds and leaderboards to a Discord test channel.
 *
 * Requires in `.env`:
 * - `DISCORD_TOKEN` — bot token (bot must be in the test server)
 * - `TEST_GUILD_ID` — Discord server snowflake
 * - `TEST_CHANNEL_ID` — text channel snowflake to post into
 *
 * @param {object} [options]
 * @param {string} [options.token]
 * @param {string} [options.guildId]
 * @param {string} [options.channelId]
 * @param {boolean} [options.resetDb=true] Re-seed ./data/showcase.db before posting
 * @param {string} [options.dbPath]
 * @param {number} [options.delayMs] Pause between messages (rate-limit friendly)
 * @param {boolean} [options.dryRun=false] Log actions without connecting to Discord
 */
export async function sendShowcaseToDiscord(options = {}) {
 const config = {
  token: options.token ?? requireEnv('DISCORD_TOKEN'),
  guildId: options.guildId ?? requireEnv('TEST_GUILD_ID'),
  channelId: options.channelId ?? requireEnv('TEST_CHANNEL_ID'),
 };
 const delayMs = options.delayMs ?? DEFAULT_POST_DELAY_MS;
 const dryRun = Boolean(options.dryRun);
 const resetDb = options.resetDb !== false;

 const htbToken = options.htbToken ?? process.env.HTB_TOKEN ?? null;

 const { seedSummary } = prepareShowcaseDatabase({
  dbPath: options.dbPath,
  resetDb,
 });

 const notifications = await buildNotificationPreviews({ htbToken });
 const leaderboards = buildAllShowcaseLeaderboards(SHOWCASE_GUILD_ID);

 const plan = {
  config,
  seedSummary,
  messages: [
   {
    kind: 'intro',
    content:
     '**HTB bot showcase** — sample own/completion notifications (fixture data, not live HTB owns).',
   },
   ...notifications.map((preview) => ({
    kind: 'notification',
    label: `${preview.member.server_nick} · ${preview.event.type}`,
    embeds: [preview.embedJson],
    files: preview.discordFiles ?? [],
   })),
   {
    kind: 'section',
    content:
     '**HTB bot showcase** — leaderboards from the seeded sample database (`data/showcase.db`).',
   },
   ...leaderboards.map((board) => ({
    kind: 'leaderboard',
    label: board.title,
    embeds: [
     {
      title: board.title,
      description: board.lines.join('\n'),
      color: 0x9fef00,
      footer: { text: board.footer },
     },
    ],
   })),
  ],
 };

 if (dryRun) {
  return { dryRun: true, plan, posted: 0 };
 }

 const client = new Client({
  intents: [GatewayIntentBits.Guilds],
 });

 try {
  await client.login(config.token);
  const channel = await client.channels.fetch(config.channelId);
  assertSendableChannel(channel, config.guildId);

  let posted = 0;
  for (const message of plan.messages) {
   if (message.kind === 'intro' || message.kind === 'section') {
    await channel.send({ content: message.content });
   } else {
    const embeds = message.embeds.map((data) => EmbedBuilder.from(data));
    await channel.send({ embeds, files: message.files ?? [] });
   }
   posted += 1;
   if (delayMs > 0) await sleep(delayMs);
  }

  return { dryRun: false, plan, posted, channelId: config.channelId, guildId: config.guildId };
 } finally {
  await client.destroy().catch(() => {});
 }
}
