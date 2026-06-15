# Posting the showcase to a Discord test server

Use this workflow to send the **sample notification embeds** and **sample
leaderboards** to a real Discord server — useful for checking how they look in
Discord before enabling live notifications in production.

The offline HTML preview (`npm run showcase`) does not need Discord. This script
does.

## What gets posted

The script:

1. Seeds (or reuses) `data/showcase.db` with fixture members and XP snapshots
2. Connects with your bot token
3. Posts to the channel configured in `.env`:
   - A short intro message
   - **6 notification embeds** — one per HTB content type (machine root/user,
     challenge, Sherlock, Pro Lab, Fortress)
   - A leaderboard section header
   - **3 leaderboard embeds** — all-time, weekly, and monthly (from the sample DB)

All content uses **fixture data**, not live HTB API calls. `HTB_TOKEN` is not
required for this script.

## Prerequisites

1. **A Discord test server** you control (not your production community server,
   unless you are fine with demo spam in a dedicated channel).
2. **The bot invited** to that server with at least:
   - View Channel
   - Send Messages
   - Embed Links
3. **A text channel** where the bot can post (note the channel ID).
4. **Node.js 20 or 22 LTS** (same as running the bot).

## Configure `.env`

Add these three variables alongside your existing bot config:

```env
DISCORD_TOKEN=your_bot_token

# Discord test server — used only by npm run showcase:discord
TEST_GUILD_ID=1234567890123456789
TEST_CHANNEL_ID=1234567890123456789
```

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Same bot token as `npm start` |
| `TEST_GUILD_ID` | Snowflake ID of your **Discord** test server |
| `TEST_CHANNEL_ID` | Snowflake ID of the **text channel** to post into |

`TEST_GUILD_ID` is separate from `GUILD_ID` (used by `deploy-commands`) and from
the fake fixture guild ID inside `data/showcase.db`. You can point both
`GUILD_ID` and `TEST_GUILD_ID` at the same dev server if you like.

### Finding server and channel IDs

1. In Discord: **User Settings → Advanced → Developer Mode** → On
2. Right-click your test server → **Copy Server ID** → `TEST_GUILD_ID`
3. Right-click the target text channel → **Copy Channel ID** → `TEST_CHANNEL_ID`

See `.env.example` for a commented template.

## Run the test script

### 1. Dry run (recommended first)

Checks your `.env` and prints what would be sent — no Discord connection:

```bash
npm run showcase:discord -- --dry-run
```

### 2. Post to Discord

```bash
npm run showcase:discord
```

Expected output:

```text
Showcase posted to Discord.

  Guild:    1234567890123456789
  Channel:  1234567890123456789
  Messages: 11
```

Open the test channel in Discord to review the embeds.

### Options

```bash
# Reuse an existing showcase.db instead of re-seeding
npm run showcase:discord -- --no-reset-db

# Slower posting if you hit rate limits
npm run showcase:discord -- --delay 1000

# Help
npm run showcase:discord -- --help
```

## Related commands

| Command | Purpose |
|---------|---------|
| `npm run showcase` | Generate `data/showcase.db` + `showcase/output/index.html` (no Discord) |
| `npm run showcase:discord` | Post the same demo content to `TEST_CHANNEL_ID` |
| `/notify test` | Post a **single** live or sample notification via slash command in-server |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Missing TEST_GUILD_ID` / `Missing TEST_CHANNEL_ID` | Add both to `.env` (see above) |
| `Channel is missing or does not support sending messages` | Wrong `TEST_CHANNEL_ID`, or channel is a forum/voice type |
| `TEST_CHANNEL_ID belongs to guild X, but TEST_GUILD_ID is Y` | Channel is not in the server you configured |
| `Missing Access` / `50001` | Bot lacks **View Channel** / **Send Messages** in that channel |
| `Cannot send an empty message` / embed errors | Rare embed limit issue; try `--delay 1000` |
| `better-sqlite3` / Node version error | Use Node 20 or 22 LTS (`node -v`) |
| Nothing appears in Discord | Confirm you are looking at the channel matching `TEST_CHANNEL_ID` |

## Programmatic use

```javascript
import 'dotenv/config';
import { sendShowcaseToDiscord } from './src/showcase/send-to-discord.js';

await sendShowcaseToDiscord({
  guildId: process.env.TEST_GUILD_ID,
  channelId: process.env.TEST_CHANNEL_ID,
});
```

## Safety notes

- The script posts **11 messages** in quick succession. Use a dedicated `#bot-testing`
  channel, not a general chat.
- Re-running the script posts the same demo content again (it does not dedupe).
- This does **not** enable the live notification watcher — it only posts static
  showcase embeds.
