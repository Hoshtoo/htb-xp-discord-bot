import { listGuildMembers, listMemberRowsForDiscordUser } from '../db.js';
import { syncMemberXp } from '../htb/sync-member.js';

export async function handleSync(interaction) {
  const targetUser = interaction.options.getUser('member');
  const guildId = interaction.guildId;

  const members = targetUser
    ? listGuildMembers(guildId).filter((m) => m.discord_user_id === targetUser.id)
    : listGuildMembers(guildId);

  if (members.length === 0) {
    let hint = '';
    if (targetUser) {
      const other = listMemberRowsForDiscordUser(targetUser.id).filter(
        (r) => r.guild_id !== guildId
      );
      if (other.length) {
        hint = ` They are linked in ${other.length} other server(s) — run \`/link\` in **this** server to add them here.`;
      }
    }
    await interaction.editReply({
      content: targetUser
        ? `**${targetUser.displayName ?? targetUser.username}** is not linked in this server. Use \`/link\` here first.${hint}`
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
