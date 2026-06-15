#!/usr/bin/env node
/**
 * Generate a sample SQLite database and an HTML showcase of notifications +
 * leaderboards. No Discord credentials required; HTB_TOKEN optional for Pro Lab logos.
 *
 * Usage:
 *   npm run showcase
 *   node scripts/showcase.mjs [--db path] [--html path]
 */

import { resolve } from 'path';
import 'dotenv/config';
import { runShowcase } from '../src/showcase/index.js';

function parseArgs(argv) {
 const options = {};
 for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--db' && argv[i + 1]) {
   options.dbPath = resolve(argv[++i]);
  } else if (arg === '--html' && argv[i + 1]) {
   options.htmlPath = resolve(argv[++i]);
  } else if (arg === '--help' || arg === '-h') {
   options.help = true;
  }
 }
 return options;
}

function printHelp() {
 console.log(`Usage: npm run showcase [-- --db <path>] [--html <path>]

Creates:
  ./data/showcase.db          Sample SQLite database (members, XP snapshots, notify settings)
  ./showcase/output/index.html  Visual preview of notification embeds + leaderboards

Thumbnails use real HTB CDN URLs. Set HTB_TOKEN in .env to refresh Pro Lab logos via API.

Options:
  --db <path>     SQLite output path (default: ./data/showcase.db)
  --html <path>   HTML output path (default: ./showcase/output/index.html)
  -h, --help      Show this help
`);
}

const cli = parseArgs(process.argv.slice(2));

if (cli.help) {
 printHelp();
 process.exit(0);
}

const { dbPath, htmlPath, memberCount, notifiableCount } = await runShowcase(cli);

console.log('Showcase generated successfully.\n');
console.log(`  Database:     ${dbPath}`);
console.log(`  HTML preview: ${htmlPath}`);
console.log(`  Members:      ${memberCount} linked (${notifiableCount} notifiable — Bob opted out)`);
console.log('\nOpen the HTML file in a browser to preview notification embeds and leaderboards.');
