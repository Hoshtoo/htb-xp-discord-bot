import {
 getBaselineXp,
 getFirstSnapshotInPeriod,
 listGuildMembers,
} from '../db.js';
import {
 formatLeaderboardLines,
 fitLeaderboardLines,
} from '../leaderboard/build-ranking.js';
import { getPeriodBounds, getPeriodTitle, getPeriodXpSuffix } from '../htb/periods.js';
import { SAMPLE_MEMBERS } from './fixtures.js';

/** @type {Map<string, { level?: number, levelTitle?: string }>} */
const levelByDiscordId = new Map(
 SAMPLE_MEMBERS.map((m) => [
  m.discord_user_id,
  { level: m.level, levelTitle: m.levelTitle },
 ])
);

function tagFor(member) {
 return member.server_nick ?? member.discord_tag ?? member.htb_username;
}

/**
 * Build a leaderboard from seeded SQLite data — no Discord client or HTB API calls.
 *
 * @param {string} guildId
 * @param {'all' | 'weekly' | 'monthly'} [period]
 * @param {Date} [now]
 */
export function buildLeaderboardFromDb(guildId, period = 'all', now = new Date()) {
 const members = listGuildMembers(guildId);
 if (members.length === 0) {
  return {
   empty: true,
   period,
   bounds: getPeriodBounds(period, now),
   title: getPeriodTitle(period),
   lines: [],
   footer: 'No linked members',
  };
 }

 const bounds = getPeriodBounds(period, now);
 const xpSuffix = getPeriodXpSuffix(period);
 const ranked = [];

 for (const member of members) {
  const tag = tagFor(member);
  const meta = levelByDiscordId.get(member.discord_user_id) ?? {};
  const totalXp = member.last_xp;

  if (totalXp == null) {
   ranked.push({
    rank: null,
    tag,
    htb: member.htb_username,
    discordUserId: member.discord_user_id,
    displayXp: null,
    error: 'no XP recorded',
    sortKey: -1,
   });
   continue;
  }

  let metric;
  let hasPeriodData = true;

  if (period === 'all') {
   metric = totalXp;
  } else {
   const periodStartIso = bounds.start.toISOString();
   const periodEndIso = bounds.end.toISOString();
   let baseline = getBaselineXp(guildId, member.discord_user_id, periodStartIso);
   if (baseline == null) {
    baseline = getFirstSnapshotInPeriod(
     guildId,
     member.discord_user_id,
     periodStartIso,
     periodEndIso
    );
    if (baseline == null) {
     hasPeriodData = false;
    }
   }
   metric = hasPeriodData ? Math.max(0, totalXp - baseline) : null;
  }

  ranked.push({
   rank: null,
   tag,
   htb: member.htb_username,
   discordUserId: member.discord_user_id,
   displayXp: metric,
   level: meta.level,
   levelTitle: meta.levelTitle,
   error: metric == null ? 'no period data yet (run /sync)' : null,
   xpSuffix,
   sortKey: metric ?? -1,
  });
 }

 const withMetric = ranked.filter((e) => e.displayXp != null);
 const withoutMetric = ranked.filter((e) => e.displayXp == null);

 withMetric.sort((a, b) => b.sortKey - a.sortKey);
 withMetric.forEach((e, i) => {
  e.rank = i + 1;
 });

 const ordered = [...withMetric, ...withoutMetric];
 const allLines = formatLeaderboardLines(ordered, xpSuffix);
 const { lines, truncated } = fitLeaderboardLines(allLines);

 const footerParts = [
  truncated
   ? `Showing ${lines.length} of ${ordered.length} linked (embed limit)`
   : `All ${ordered.length} linked`,
 ];
 if (period !== 'all' && bounds.label) {
  footerParts.push(bounds.label);
 }
 footerParts.push(now.toLocaleString());

 return {
  empty: false,
  period,
  bounds,
  title: getPeriodTitle(period),
  lines,
  truncated,
  total: ordered.length,
  footer: footerParts.join(' · '),
  ordered,
 };
}

/**
 * @param {string} guildId
 * @param {Date} [now]
 */
export function buildAllShowcaseLeaderboards(guildId, now = new Date()) {
 return ['all', 'weekly', 'monthly'].map((period) =>
  buildLeaderboardFromDb(guildId, /** @type {'all' | 'weekly' | 'monthly'} */ (period), now)
 );
}
