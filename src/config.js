import 'dotenv/config';

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discordToken: () => requireEnv('DISCORD_TOKEN'),
  htbToken: () => requireEnv('HTB_TOKEN'),
  guildId: process.env.GUILD_ID || null,
};
