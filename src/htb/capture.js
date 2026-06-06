import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { captureProfile } from '../../scripts/htb-render-profile.mjs';
import { buildExperienceUrl } from './resolve.js';

/**
 * @param {Array<{ url: string, status?: number, body?: object }>} captures
 * @param {{ accountIdFallback?: string | null }} [options]
 */
export function parseExperienceFromCaptures(captures, options = {}) {
  const { accountIdFallback = null } = options;

  const hits = captures.filter((c) => {
    try {
      const pathname = new URL(c.url).pathname;
      return /^\/api\/experience\/v1\/account\/[0-9a-f-]{36}$/i.test(pathname);
    } catch {
      return false;
    }
  });

  if (hits.length === 0) return null;

  const scored = hits
    .map((capture) => ({ capture, score: scoreExperienceCapture(capture, accountIdFallback) }))
    .sort((a, b) => b.score - a.score);

  const hit = scored[0].capture;

  return {
    experienceUrl: hit.url,
    totalExperiencePoints: hit.body?.totalExperiencePoints ?? null,
    accountId: hit.url.match(/account\/([0-9a-f-]{36})/i)?.[1] ?? null,
  };
}

function scoreExperienceCapture(capture, accountIdFallback) {
  let score = 0;
  if (capture.status === 200) score += 10;
  if (capture.body?.totalExperiencePoints != null) score += 10;

  const accountId = capture.url.match(/account\/([0-9a-f-]{36})/i)?.[1] ?? null;
  if (accountIdFallback && accountId === accountIdFallback) score += 20;

  return score;
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
  let parsed = parseExperienceFromCaptures(captures, {
    accountIdFallback: options.accountIdFallback,
  });

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
