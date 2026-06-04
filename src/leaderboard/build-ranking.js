import {
  getBaselineXp,
  getFirstSnapshotInPeriod,
  listGuildMembers,
  updateMemberXp,
} from '../db.js';
import { fetchAllExperience } from '../htb/experience.js';
import { getPeriodBounds, getPeriodXpSuffix } from '../htb/periods.js';
import { recordMemberXp } from '../htb/record-xp.js';

const PAGE_SIZE = 10;

function formatRank(n) {
  if (n === 1) return '🥇';
  if (n === 2) return '🥈';
  if (n === 3) return '🥉';
  return `#${n}`;
}

/**
 * @param {string} guildId
 * @param {'all' | 'weekly' | 'monthly'} period
 */
export async function buildGuildRanking(guildId, period = 'all') {
  const members = listGuildMembers(guildId);
  if (members.length === 0) {
    return { empty: true, period, bounds: getPeriodBounds(period) };
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
        tag: r.member.discord_tag,
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
      tag: r.member.discord_tag,
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
      tag: m.discord_tag,
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
  const page = ordered.slice(0, PAGE_SIZE);

  return {
    empty: false,
    period,
    bounds,
    page,
    total: ordered.length,
    xpSuffix,
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

export { PAGE_SIZE };
