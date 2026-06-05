import { Routes } from 'discord.js';
import { ensureGuild } from './ensure-guild.js';

const CONCURRENCY = 3;

function memberDisplayNameFromApi(apiMember, fallback) {
  const user = apiMember.user;
  const nick = apiMember.nick?.trim();
  if (nick) return nick;
  return user?.global_name ?? user?.username ?? fallback;
}

/**
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} discordUserId
 * @param {string} [fallback]
 * @param {import('discord.js').Guild | null} [guild]
 * @param {import('discord.js').GuildMember | null} [resolvedMember]
 */
export async function getGuildDisplayName(
  client,
  guildId,
  discordUserId,
  fallback = 'Unknown',
  guild = null,
  resolvedMember = null
) {
  const effectiveFallback = fallback;
  if (resolvedMember?.id === discordUserId) {
    return resolvedMember.displayName;
  }

  const cachedGuild = guild ?? (await ensureGuild(client, guildId));
  if (cachedGuild) {
    try {
      const member = await cachedGuild.members.fetch({
        user: discordUserId,
        force: true,
      });
      return member.displayName;
    } catch {
      // fall through to REST
    }
  }

  try {
    const data = await client.rest.get(Routes.guildMember(guildId, discordUserId));
    return memberDisplayNameFromApi(data, effectiveFallback);
  } catch {
    return effectiveFallback;
  }
}

/**
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {Array<{ discord_user_id: string, discord_tag?: string | null }>} members
 * @param {import('discord.js').Guild | null} [guild]
 */
export async function resolveGuildDisplayNames(client, guildId, members, guild = null) {
  const names = new Map();
  let index = 0;

  async function worker() {
    while (index < members.length) {
      const i = index++;
      const row = members[i];
      const fallback = row.discord_tag ?? row.server_nick ?? 'Unknown';
      const displayName = await getGuildDisplayName(
        client,
        guildId,
        row.discord_user_id,
        fallback,
        guild
      );
      names.set(row.discord_user_id, displayName);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, members.length) },
    () => worker()
  );
  await Promise.all(workers);
  return names;
}
