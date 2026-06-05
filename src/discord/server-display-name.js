function collectionGet(collection, key) {
  if (!collection) return undefined;
  if (typeof collection.get === 'function') return collection.get(key);
  return collection[key];
}

function resolvedMemberNick(resolvedMember) {
  if (!resolvedMember) return null;
  const nick = resolvedMember.nickname ?? resolvedMember.nick;
  return nick?.trim() || null;
}

/**
 * Server nickname / display name from slash command resolved payload (no guild cache needed).
 * @param {import('discord.js').CommandInteractionResolvedData | null} [resolved]
 */
export function getServerDisplayName({ guildMember, discordUser, resolved }) {
  const userId = discordUser.id;

  if (guildMember) {
    return {
      label: guildMember.displayName,
      nick: guildMember.nickname,
      source: 'guildMember',
    };
  }

  const resolvedMember = collectionGet(resolved?.members, userId);
  const resolvedUser = collectionGet(resolved?.users, userId);
  const nick = resolvedMemberNick(resolvedMember);

  if (nick) {
    return {
      label: nick,
      nick,
      source: 'resolved.nick',
    };
  }

  const label =
    resolvedUser?.globalName ??
    resolvedUser?.global_name ??
    resolvedUser?.username ??
    discordUser.globalName ??
    discordUser.displayName ??
    discordUser.username;

  return {
    label,
    nick: null,
    source: 'resolved.user',
  };
}
