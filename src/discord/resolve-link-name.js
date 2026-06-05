import { Routes } from 'discord.js';

/**
 * Best-effort server nickname for /link (resolved payload → cache → REST).
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {import('discord.js').User} discordUser
 * @param {import('discord.js').GuildMember | null} guildMember
 * @param {{ label: string, nick: string | null, source: string }} nameInfo
 */
export async function resolveLinkDisplayName(
  client,
  guildId,
  discordUser,
  guildMember,
  nameInfo
) {
  if (nameInfo.nick) return nameInfo;

  if (guildMember?.nickname) {
    return {
      label: guildMember.displayName,
      nick: guildMember.nickname,
      source: 'guildMember',
    };
  }

  try {
    const data = await client.rest.get(
      Routes.guildMember(guildId, discordUser.id)
    );
    const nick = data.nick?.trim();
    if (nick) {
      return { label: nick, nick, source: 'rest.nick' };
    }
    const label =
      data.user?.global_name ??
      data.user?.username ??
      nameInfo.label;
    return { label, nick: null, source: 'rest.user' };
  } catch {
    return nameInfo;
  }
}
