import { EmbedBuilder } from 'discord.js';
import { listGuildMembers, updateMemberXp } from '../db.js';
import { fetchAllExperience } from '../htb/experience.js';

const PAGE_SIZE = 10;

function formatRank(n) {
  if (n === 1) return '🥇';
  if (n === 2) return '🥈';
  if (n === 3) return '🥉';
  return `#${n}`;
}

export async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  const members = listGuildMembers(interaction.guildId);
  if (members.length === 0) {
    await interaction.editReply({
      content: 'No linked members yet. Use `/link` to add HTB accounts.',
    });
    return;
  }

  const withUrl = members.filter((m) => m.experience_url);
  const noUrl = members.filter((m) => !m.experience_url);

  const results = await fetchAllExperience(
    withUrl.map((m) => ({ member: m, experienceUrl: m.experience_url }))
  );

  const now = new Date().toISOString();

  for (const r of results) {
    if (r.ok && r.totalExperiencePoints != null) {
      updateMemberXp(
        interaction.guildId,
        r.member.discord_user_id,
        r.totalExperiencePoints,
        now
      );
    }
  }

  const ranked = [
    ...results
      .filter((r) => r.ok && r.totalExperiencePoints != null)
      .sort((a, b) => b.totalExperiencePoints - a.totalExperiencePoints)
      .map((r, i) => ({
        rank: i + 1,
        tag: r.member.discord_tag,
        htb: r.member.htb_username,
        xp: r.totalExperiencePoints,
        level: r.level,
        levelTitle: r.levelTitle,
      })),
    ...results
      .filter((r) => !r.ok || r.totalExperiencePoints == null)
      .map((r) => ({
        rank: null,
        tag: r.member.discord_tag,
        htb: r.member.htb_username,
        xp: null,
        error: r.error,
      })),
    ...noUrl.map((m) => ({
      rank: null,
      tag: m.discord_tag,
      htb: m.htb_username,
      xp: null,
      error: 'no experience URL',
    })),
  ];

  const page = ranked.slice(0, PAGE_SIZE);
  const lines = page.map((entry) => {
    if (entry.rank != null) {
      const lvl =
        entry.level != null
          ? ` · Lvl ${entry.level}${entry.levelTitle ? ` ${entry.levelTitle}` : ''}`
          : '';
      return `${formatRank(entry.rank)} **${entry.tag}** (${entry.htb}) — **${entry.xp.toLocaleString()}** XP${lvl}`;
    }
    return `— **${entry.tag}** (${entry.htb}) — XP unavailable${entry.error ? ` (${entry.error})` : ''}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('HTB XP Leaderboard')
    .setDescription(lines.join('\n') || 'No data.')
    .setFooter({
      text: `Showing top ${page.length} of ${ranked.length} linked · ${new Date().toLocaleString()}`,
    })
    .setColor(0x9fef00);

  await interaction.editReply({ embeds: [embed] });
}
