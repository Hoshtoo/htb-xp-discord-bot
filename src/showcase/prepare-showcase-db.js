import { mkdirSync, unlinkSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { getDb } from '../db.js';
import { seedShowcaseDatabase } from './seed-database.js';
import { DEFAULT_SHOWCASE_DB_PATH } from './fixtures.js';

/**
 * Create or reset the showcase SQLite database and seed fixture rows.
 *
 * @param {object} [options]
 * @param {string} [options.dbPath]
 * @param {boolean} [options.resetDb=true]
 * @param {Date} [options.now]
 */
export function prepareShowcaseDatabase(options = {}) {
 const dbPath = resolve(options.dbPath ?? DEFAULT_SHOWCASE_DB_PATH);
 const now = options.now ?? new Date();
 const resetDb = options.resetDb !== false;

 mkdirSync(dirname(dbPath), { recursive: true });
 if (resetDb && existsSync(dbPath)) {
  unlinkSync(dbPath);
 }

 process.env.DATABASE_PATH = dbPath;
 getDb();

 return { dbPath, seedSummary: seedShowcaseDatabase({ now }) };
}
