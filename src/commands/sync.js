import { listGuildMembers } from '../db.js';
import { syncMemberXp } from '../htb/sync-member.js';

export async function handleSync(interaction) {
  const targetUser = interaction.options.getUser('member');
  await interaction.deferReply();

  const members = targetUser
    ? listGuildMembers(interaction.guildId).filter(
        (m) => m.discord_user_id === targetUser.id
      )
    : listGuildMembers(interaction.guildId);

  if (members.length === 0) {
    await interaction.editReply({
      content: targetUser
        ? `**${targetUser.displayName ?? targetUser.username}** is not linked. Use \`/link\` first.`
        : 'No linked members in this server. Use `/link` first.',
    });
    return;
  }

  const lines = [];
  let ok = 0;
  let fail = 0;

  for (const row of members) {
    try {
      const result = await syncMemberXp(row);
      ok++;
      const xp =
        result.totalExperiencePoints != null
          ? ` — **${result.totalExperiencePoints.toLocaleString()}** XP`
          : '';
      lines.push(`✓ **${row.discord_tag}** (${result.htbUsername})${xp}`);
    } catch (err) {
      fail++;
      lines.push(`✗ **${row.discord_tag}** — ${err.message || 'sync failed'}`);
    }
  }

  await interaction.editReply({
    content: `Sync complete: **${ok}** ok, **${fail}** failed.\n${lines.join('\n')}`.slice(
      0,
      2000
    ),
  });
}
