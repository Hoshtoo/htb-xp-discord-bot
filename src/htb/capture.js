import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { captureProfile } from '../../scripts/htb-render-profile.mjs';
import { buildExperienceUrl } from './resolve.js';

const EXPERIENCE_URL_RE = /\/api\/experience\/v1\/account\/[0-9a-f-]{36}/i;

/**
 * @param {Array<{ url: string, body?: object }>} captures
 */
export function parseExperienceFromCaptures(captures) {
  const hits = captures.filter((c) => EXPERIENCE_URL_RE.test(c.url));
  const hit = hits.at(-1);
  if (!hit) return null;

  return {
    experienceUrl: hit.url,
    totalExperiencePoints: hit.body?.totalExperiencePoints ?? null,
    accountId: hit.url.match(/account\/([0-9a-f-]{36})/i)?.[1] ?? null,
  };
}

/**
 * @param {string} userId
 * @param {string} outDir
 * @param {{ token?: string, accountIdFallback?: string | null }} [options]
 */
export async function captureAndParseExperience(userId, outDir, options = {}) {
  await captureProfile(userId, outDir, { token: options.token });

  const raw = await readFile(join(outDir, 'api-captures.json'), 'utf8');
  const captures = JSON.parse(raw);
  let parsed = parseExperienceFromCaptures(captures);

  if (!parsed?.experienceUrl && options.accountIdFallback) {
    parsed = {
      experienceUrl: buildExperienceUrl(options.accountIdFallback),
      totalExperiencePoints: null,
      accountId: options.accountIdFallback,
    };
  }

  return parsed;
}

/**
 * @param {string} guildId
 * @param {string} discordUserId
 * @param {string} htbUserId
 * @param {{ token?: string, accountIdFallback?: string | null }} [options]
 */
export async function captureForMember(guildId, discordUserId, htbUserId, options = {}) {
  const botRoot = fileURLToPath(new URL('../..', import.meta.url));
  const outDir = join(botRoot, 'data', 'captures', guildId, discordUserId);

  try {
    return await captureAndParseExperience(htbUserId, outDir, options);
  } finally {
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
