function waitForReady(client) {
  if (client.isReady()) return Promise.resolve();
  return new Promise((resolve) => client.once('ready', resolve));
}

/**
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
export async function ensureGuild(client, guildId) {
  await waitForReady(client);

  if (client.guilds.cache.size === 0) {
    await client.guilds.fetch().catch(() => {});
  }

  let guild = client.guilds.cache.get(guildId) ?? null;

  if (!guild) {
    try {
      guild = await client.guilds.fetch(guildId);
    } catch {
      // guild not visible to this bot
    }
  }

  return guild;
}
