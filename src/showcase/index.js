import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { buildShowcasePage } from './build-showcase-page.js';
import { DEFAULT_SHOWCASE_DB_PATH, DEFAULT_SHOWCASE_HTML_PATH } from './fixtures.js';
import { prepareShowcaseDatabase } from './prepare-showcase-db.js';

export {
 DEFAULT_SHOWCASE_DB_PATH,
 DEFAULT_SHOWCASE_HTML_PATH,
 SHOWCASE_GUILD_ID,
 SHOWCASE_CHANNEL_ID,
 SAMPLE_MEMBERS,
 SAMPLE_NOTIFICATION_EVENTS,
} from './fixtures.js';
export { seedShowcaseDatabase } from './seed-database.js';
export { prepareShowcaseDatabase } from './prepare-showcase-db.js';
export { buildLeaderboardFromDb, buildAllShowcaseLeaderboards } from './leaderboard-from-db.js';
export { buildNotificationPreviews, buildLeaderboardPreviews } from './build-showcase-page.js';
export { renderEmbedPreview } from './render-embed.js';
export {
 resolveShowcaseThumbnailUrls,
 buildShowcaseDisplayUrls,
 buildShowcaseEmbedImages,
} from './resolve-thumbnails.js';
export { sendShowcaseToDiscord, getDiscordTestConfig } from './send-to-discord.js';

/**
 * Create a fresh sample database and HTML showcase page.
 *
 * @param {object} [options]
 * @param {string} [options.dbPath] SQLite file path (default ./data/showcase.db)
 * @param {string} [options.htmlPath] HTML output path (default ./showcase/output/index.html)
 * @param {Date} [options.now] Reference time for snapshots / leaderboards
 * @param {boolean} [options.resetDb=true] Delete existing DB file before seeding
 * @param {string|null} [options.htbToken] HTB app token for live thumbnail resolution
 */
export async function runShowcase(options = {}) {
 const htmlPath = resolve(options.htmlPath ?? DEFAULT_SHOWCASE_HTML_PATH);
 const now = options.now ?? new Date();
 const htbToken = options.htbToken ?? process.env.HTB_TOKEN ?? null;

 const { dbPath, seedSummary } = prepareShowcaseDatabase(options);
 const html = await buildShowcasePage(seedSummary, dbPath, now, { htbToken });

 mkdirSync(dirname(htmlPath), { recursive: true });
 writeFileSync(htmlPath, html, 'utf8');

 return {
  dbPath,
  htmlPath,
  seedSummary,
  memberCount: seedSummary.memberCount,
  notifiableCount: seedSummary.notifiableCount,
 };
}
