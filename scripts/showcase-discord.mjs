#!/usr/bin/env node
/**
 * Post the offline showcase (notification embeds + leaderboards) to a Discord
 * test server configured in .env.
 *
 * Usage:
 *   npm run showcase:discord
 *   node scripts/showcase-discord.mjs [--dry-run] [--no-reset-db]
 */

import 'dotenv/config';
import { sendShowcaseToDiscord } from '../src/showcase/send-to-discord.js';

function parseArgs(argv) {
 const options = { dryRun: false, resetDb: true };
 for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--dry-run') options.dryRun = true;
  else if (arg === '--no-reset-db') options.resetDb = false;
  else if (arg === '--delay' && argv[i + 1]) options.delayMs = Number(argv[++i]);
  else if (arg === '--help' || arg === '-h') options.help = true;
 }
 return options;
}

function printHelp() {
 console.log(`Usage: npm run showcase:discord [-- options]

Posts sample notification embeds and leaderboards to your Discord test server.

Required .env variables (see docs/SHOWCASE_DISCORD.md):
  DISCORD_TOKEN      Bot token
  TEST_GUILD_ID      Discord server ID to post in
  TEST_CHANNEL_ID    Text channel ID to post into

Options:
  --dry-run          Print the post plan without connecting to Discord
  --no-reset-db      Reuse existing data/showcase.db instead of re-seeding
  --delay <ms>       Pause between messages (default: 450)
  -h, --help         Show this help
`);
}

const cli = parseArgs(process.argv.slice(2));

if (cli.help) {
 printHelp();
 process.exit(0);
}

try {
 const result = await sendShowcaseToDiscord(cli);

 if (result.dryRun) {
  console.log('Dry run — would post to:');
  console.log(`  Guild:   ${result.plan.config.guildId}`);
  console.log(`  Channel: ${result.plan.config.channelId}`);
  console.log(`  Messages: ${result.plan.messages.length}`);
  for (const message of result.plan.messages) {
   if (message.label) console.log(`    - ${message.kind}: ${message.label}`);
   else console.log(`    - ${message.kind}`);
  }
  process.exit(0);
 }

 console.log('Showcase posted to Discord.\n');
 console.log(`  Guild:    ${result.guildId}`);
 console.log(`  Channel:  ${result.channelId}`);
 console.log(`  Messages: ${result.posted}`);
} catch (err) {
 console.error(err.message || err);
 process.exit(1);
}
