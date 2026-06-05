import {
  getBaselineXp,
  getFirstSnapshotInPeriod,
  listGuildMembers,
  updateMemberDisplayNames,
  updateMemberXp,
} from '../db.js';
import { resolveGuildDisplayNames } from '../discord/display-name.js';
import { fetchAllExperience } from '../htb/experience.js';
import { getPeriodBounds, getPeriodXpSuffix } from '../htb/periods.js';
import { recordMemberXp } from '../htb/record-xp.js';

export const DEFAULT_LEADERBOARD_LIMIT = 10;
export const MAX_LEADERBOARD_LIMIT = 100;
const DISCORD_EMBED_DESC_MAX = 4096;

/**
 * @param {{ showAll?: boolean, limit?: number | null }} options
 * @returns {number | null} Slice size, or null for everyone linked
 */
export function resolveLeaderboardLimit({ showAll = false, limit = null } = {}) {
  if (showAll) return null;
  const n = limit ?? DEFAULT_LEADERBOARD_LIMIT;
  return Math.min(Math.max(1, Math.floor(n)), MAX_LEADERBOARD_LIMIT);
}

/**
 * @param {string[]} lines
 * @param {number} [maxChars]
 */
export function fitLeaderboardLines(lines, maxChars = DISCORD_EMBED_DESC_MAX) {
  const out = [];
  let len = 0;
  for (const line of lines) {
    const sep = out.length ? 1 : 0;
    if (len + sep + line.length > maxChars - 40) {
      return { lines: out, truncated: true };
    }
    out.push(line);
    len += sep + line.length;
  }
  return { lines: out, truncated: false };
}

function formatRank(n) {
  if (n === 1) return '🥇';
  if (n === 2) return '🥈';
  if (n === 3) return '🥉';
  return `#${n}`;
}

function tagFor(member, displayNames) {
  const live = displayNames.get(member.discord_user_id);
  if (live) return live;
  return member.server_nick ?? member.discord_tag ?? 'Unknown';
}

/**
 * @param {string} guildId
 * @param {import('discord.js').Client} client
 * @param {'all' | 'weekly' | 'monthly'} period
 * @param {import('discord.js').Guild | null} [guild]
 * @param {number | null} [limit] null = show all linked members
 */
export async function buildGuildRanking(
  guildId,
  client,
  period = 'all',
  guild = null,
  limit = DEFAULT_LEADERBOARD_LIMIT
) {
  if (!guildId) {
    throw new Error('guildId is required to build leaderboard');
  }

  const members = listGuildMembers(guildId);
  if (members.length === 0) {
    return { empty: true, period, bounds: getPeriodBounds(period) };
  }

  const displayNames = await resolveGuildDisplayNames(client, guildId, members, guild);
  for (const m of members) {
    const name = displayNames.get(m.discord_user_id);
    if (!name) continue;
    if (name !== m.discord_tag || name !== m.server_nick) {
      updateMemberDisplayNames(guildId, m.discord_user_id, name, name);
    }
  }

  const withUrl = members.filter((m) => m.experience_url);
  const noUrl = members.filter((m) => !m.experience_url);

  const results = await fetchAllExperience(
    withUrl.map((m) => ({ member: m, experienceUrl: m.experience_url }))
  );

  const now = new Date();
  const nowIso = now.toISOString();
  const bounds = getPeriodBounds(period, now);

  for (const r of results) {
    if (r.ok && r.totalExperiencePoints != null) {
      updateMemberXp(guildId, r.member.discord_user_id, r.totalExperiencePoints, nowIso);
      recordMemberXp(guildId, r.member.discord_user_id, r.totalExperiencePoints, now);
    }
  }

  const xpSuffix = getPeriodXpSuffix(period);
  const ranked = [];

  for (const r of results) {
    if (!r.ok || r.totalExperiencePoints == null) {
      ranked.push({
        rank: null,
        tag: tagFor(r.member, displayNames),
        htb: r.member.htb_username,
        displayXp: null,
        error: r.error,
      });
      continue;
    }

    let metric;
    let hasPeriodData = true;

    if (period === 'all') {
      metric = r.totalExperiencePoints;
    } else {
      const periodStartIso = bounds.start.toISOString();
      const periodEndIso = bounds.end.toISOString();
      let baseline = getBaselineXp(
        guildId,
        r.member.discord_user_id,
        periodStartIso
      );
      if (baseline == null) {
        baseline = getFirstSnapshotInPeriod(
          guildId,
          r.member.discord_user_id,
          periodStartIso,
          periodEndIso
        );
        if (baseline == null) {
          hasPeriodData = false;
        }
      }
      if (hasPeriodData) {
        metric = Math.max(0, r.totalExperiencePoints - baseline);
      } else {
        metric = null;
      }
    }

    ranked.push({
      rank: null,
      tag: tagFor(r.member, displayNames),
      htb: r.member.htb_username,
      displayXp: metric,
      level: r.level,
      levelTitle: r.levelTitle,
      error: hasPeriodData ? null : 'no period data yet (run /sync)',
      xpSuffix,
      sortKey: metric ?? -1,
    });
  }

  for (const m of noUrl) {
    ranked.push({
      rank: null,
      tag: tagFor(m, displayNames),
      htb: m.htb_username,
      displayXp: null,
      error: 'no experience URL',
      sortKey: -1,
    });
  }

  const withMetric = ranked.filter((e) => e.displayXp != null);
  const withoutMetric = ranked.filter((e) => e.displayXp == null);

  withMetric.sort((a, b) => b.sortKey - a.sortKey);
  withMetric.forEach((e, i) => {
    e.rank = i + 1;
  });

  const ordered = [...withMetric, ...withoutMetric];
  const page = limit == null ? ordered : ordered.slice(0, limit);

  return {
    empty: false,
    period,
    bounds,
    page,
    total: ordered.length,
    xpSuffix,
    showAll: limit == null,
    limit: limit ?? ordered.length,
  };
}

export function formatLeaderboardLines(page, xpSuffix) {
  const isPeriod = xpSuffix.includes('this week') || xpSuffix.includes('this month');
  return page.map((entry) => {
    if (entry.rank != null) {
      const lvl =
        entry.level != null
          ? ` · Lvl ${entry.level}${entry.levelTitle ? ` ${entry.levelTitle}` : ''}`
          : '';
      const xpText = isPeriod
        ? `+${entry.displayXp.toLocaleString()}${xpSuffix}`
        : `${entry.displayXp.toLocaleString()}${xpSuffix}`;
      return `${formatRank(entry.rank)} **${entry.tag}** (${entry.htb}) — **${xpText}**${lvl}`;
    }
    return `— **${entry.tag}** (${entry.htb}) — XP unavailable${entry.error ? ` (${entry.error})` : ''}`;
  });
}

/** @deprecated Use DEFAULT_LEADERBOARD_LIMIT */
export const PAGE_SIZE = DEFAULT_LEADERBOARD_LIMIT;
