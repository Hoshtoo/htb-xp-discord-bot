import { EmbedBuilder } from 'discord.js';
import { buildAllTimeRankMap, fitLeaderboardLines } from '../leaderboard/build-ranking.js';

export const MOG_RANK_WINDOW = 5;
const MOG_SUCCESS_COLOR = 0x57f287;
const MOG_FAIL_COLOR = 0xed4245;
const MOG_VERDICT_SUCCESS = 'MOGGEDDDDDDD';
const MOG_VERDICT_FAIL = 'MOG FAILED';
const NO_COMPARABLE_STATS_ERROR =
  'No comparable stats — neither player has a non-zero value in any category.';

/**
 * @param {string} guildId
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild | null} [guild]
 */
export async function getAllTimeRankMapByDiscordId(guildId, client, guild = null) {
  return buildAllTimeRankMap(guildId, client, guild);
}

/**
 * @param {string} challengerId
 * @param {string} targetId
 * @param {Map<string, { rank: number, tag: string, htb: string }>} rankMap
 */
export function assertMogEligible(challengerId, targetId, rankMap) {
  if (challengerId === targetId) {
    throw new Error('You cannot mog yourself.');
  }

  const challenger = rankMap.get(String(challengerId));
  const target = rankMap.get(String(targetId));

  if (!challenger) {
    throw new Error('You are not on the all-time server leaderboard. Use `/link` and `/sync` first.');
  }
  if (!target) {
    throw new Error('That member is not on the all-time server leaderboard. They may need `/link` or `/sync`.');
  }

  if (target.rank > challenger.rank) {
    const ranksBelow = target.rank - challenger.rank;
    if (ranksBelow > MOG_RANK_WINDOW) {
      throw new Error(
        `You can only mog someone up to **${MOG_RANK_WINDOW}** ranks below you on the all-time leaderboard ` +
          `(you are **#${challenger.rank}**, they are **#${target.rank}**). ` +
          `You can always mog someone ranked above you.`
      );
    }
  }

  return { challenger, target };
}

/**
 * @param {import('../htb/mog-profile.js').fetchMogProfile extends (...args: any) => Promise<infer R> ? R : never} stats
 */
function mogRows(stats) {
  return [
    { key: 'xp', label: 'XP', value: stats.xp, format: (n) => n.toLocaleString() },
    { key: 'machinesTotal', label: 'Machine solves', value: stats.machinesTotal },
    { key: 'easy', label: 'Easy machines', value: stats.machinesByDifficulty.easy },
    { key: 'medium', label: 'Medium machines', value: stats.machinesByDifficulty.medium },
    { key: 'hard', label: 'Hard machines', value: stats.machinesByDifficulty.hard },
    { key: 'insane', label: 'Insane machines', value: stats.machinesByDifficulty.insane },
    { key: 'challengesTotal', label: 'Challenge solves', value: stats.challengesTotal },
    { key: 'sherlocksTotal', label: 'Sherlock solves', value: stats.sherlocksTotal },
    { key: 'proLabsSolved', label: 'Pro Lab solves', value: stats.proLabsSolved },
    { key: 'miniProLabsSolved', label: 'Mini Pro Lab solves', value: stats.miniProLabsSolved },
    { key: 'proLabsProgressPct', label: 'Pro Lab progress', value: stats.proLabsProgressPct, format: (n) => `${n}%` },
    {
      key: 'miniProLabsProgressPct',
      label: 'Mini Pro Lab progress',
      value: stats.miniProLabsProgressPct,
      format: (n) => `${n}%`,
    },
  ];
}

/**
 * @param {ReturnType<typeof mogRows>} challengerRows
 * @param {ReturnType<typeof mogRows>} targetRows
 */
function comparableRows(challengerRows, targetRows) {
  return challengerRows
    .map((row, index) => ({ row, targetRow: targetRows[index] }))
    .filter(({ row, targetRow }) => (row.value ?? 0) > 0 || (targetRow.value ?? 0) > 0);
}

/**
 * @param {ReturnType<typeof comparableRows>} pairs
 */
function scoreMogRows(pairs) {
  let wins = 0;
  let losses = 0;
  const lines = pairs.map(({ row, targetRow }) => {
    const youVal = row.value ?? 0;
    const themVal = targetRow.value ?? 0;
    const won = youVal > themVal;
    if (won) wins++;
    else losses++;
    const icon = won ? '✅' : '❌';
    const fmt = row.format ?? ((n) => String(n));
    return `${icon} **${row.label}** · You ${fmt(youVal)} — Them ${fmt(themVal)}`;
  });
  return { lines, wins, losses };
}

export function mogSucceeded(wins, losses) {
  return wins > losses;
}

/**
 * @param {{
 *   challenger: { tag: string, rank: number },
 *   target: { tag: string, rank: number },
 *   challengerStats: object,
 *   targetStats: object,
 * }} params
 * @returns {{ error: string } | { embeds: EmbedBuilder[], succeeded: boolean }}
 */
export function buildMogEmbed({ challenger, target, challengerStats, targetStats }) {
  const pairs = comparableRows(mogRows(challengerStats), mogRows(targetStats));

  if (pairs.length === 0) {
    return { error: NO_COMPARABLE_STATS_ERROR };
  }

  const { lines, wins, losses } = scoreMogRows(pairs);
  const succeeded = mogSucceeded(wins, losses);
  const color = succeeded ? MOG_SUCCESS_COLOR : MOG_FAIL_COLOR;
  const verdict = succeeded ? MOG_VERDICT_SUCCESS : MOG_VERDICT_FAIL;

  const { lines: fitted, truncated } = fitLeaderboardLines(lines);

  const statsEmbed = new EmbedBuilder()
    .setTitle(`MOG — ${challenger.tag} vs ${target.tag}`)
    .setDescription(fitted.join('\n'))
    .setColor(color)
    .setFooter({
      text: [
        `${wins} won · ${losses} lost (${pairs.length} compared)`,
        `#${challenger.rank} vs #${target.rank} on server leaderboard`,
        truncated ? 'Some rows truncated (embed limit)' : null,
        new Date().toLocaleString(),
      ]
        .filter(Boolean)
        .join(' · '),
    });

  const verdictEmbed = new EmbedBuilder().setTitle(verdict).setColor(color);

  return { embeds: [statsEmbed, verdictEmbed], succeeded };
}
