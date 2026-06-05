# HTB Discord Bot

A Discord bot that links server members to [Hack The Box](https://www.hackthebox.com/) accounts and displays a **per-server XP leaderboard**. Each guild keeps its own list of linked members.

## Features

- **`/link`** — Associate a Discord member with an HTB username (or numeric user ID)
- **`/sync`** — Refresh XP for linked members from stored HTB Experience API URLs
- **`/leaderboard`** — All-time, weekly, or monthly XP rankings (per-server)
- **`/unlink`** — Remove a member's link
- Per-guild SQLite storage with XP snapshot history (no external database required)
- Username resolution via HTB search API (no need to look up numeric IDs manually)
- **Server nicknames** on leaderboards (refreshed on each `/leaderboard`, stored on `/link`)

## How it works

| Step | What happens |
|------|----------------|
| **Link** | Resolves HTB user → runs headless Chrome (Playwright) to capture profile API calls → stores the Experience v1 URL (`/api/experience/v1/account/{uuid}`) |
| **Sync / Leaderboard** | Fetches XP from stored URLs directly (public Experience API, no browser) |
| **XP history** | Each sync/leaderboard/link records a snapshot; weekly/monthly boards compare current total vs period start |
| **Display names** | `/link` stores server nickname + display label; `/leaderboard` re-fetches live names from Discord and updates the database |

`/link` is the only command that uses Playwright. It requires a valid `HTB_TOKEN` and Chrome installed on the host.

## Requirements

- **Node.js** 18 or newer
- **Google Chrome** (or Chromium) for Playwright during `/link`
- A **Discord bot** with the `applications.commands` scope
- An **HTB app token** for `/link` (see below)

## Quick start

```bash
git clone https://github.com/Hoshtoo/htb-discord-bot.git
cd htb-discord-bot
cp .env.example .env
# Edit .env — set DISCORD_TOKEN and HTB_TOKEN (see Configuration)
npm install
npm run install-browser
npm run deploy-commands
npm start
```

Invite the bot to your server (see [Invite the bot](#6-invite-the-bot)), then run `/link` in a channel.

---

## Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/Hoshtoo/htb-discord-bot.git
cd htb-discord-bot
npm install
```

### 2. Install Playwright browser

`/link` uses Playwright with the Chrome channel:

```bash
npm run install-browser
```

On Linux, if Chrome is already installed system-wide, you can skip this and set `PW_CHANNEL=chrome` in `.env` (default).

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your tokens (see [Configuration](#configuration)).

### 4. Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. **New Application** → choose a name.
3. Open **Bot** → **Reset Token** → copy the token into `DISCORD_TOKEN` in `.env`.
4. Under **Privileged Gateway Intents**, enable **Server Members Intent** (required for server nicknames on leaderboards). Save changes, then **re-invite** the bot to your server (see below).
5. You do **not** need to configure **OAuth2 → Redirects** for this bot — redirect URIs are only for “Login with Discord” web apps. Use the invite URL from the URL Generator (step 6).

### 5. Register slash commands

**Development (recommended)** — commands appear immediately in one server:

```bash
# Add your server ID to .env
echo 'GUILD_ID=YOUR_SERVER_ID' >> .env
npm run deploy-commands
```

To find your server ID: enable Developer Mode in Discord (Settings → Advanced), then right-click the server icon → **Copy Server ID**.

**Production** — global commands (can take up to an hour to propagate):

```bash
# Remove or comment out GUILD_ID in .env
npm run deploy-commands
```

### 6. Invite the bot

Use the **same application** whose bot token you put in `DISCORD_TOKEN`.

**Recommended (Developer Portal):**

1. Open **OAuth2 → URL Generator**.
2. Scopes: `bot`, `applications.commands`.
3. Bot permissions: at least **View Channels**, **Send Messages**, **Use Slash Commands** (add others as needed).
4. Copy the generated URL, open it in a browser, and add the bot to your server.

**Or** build the URL manually — replace `YOUR_CLIENT_ID` with the **Application ID** from **OAuth2 → General** (same app as the bot token):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=0&scope=bot%20applications.commands
```

### 7. Run the bot

```bash
npm start
```

On startup you should see something like:

```
Logged in as YourBot#1234 (123456789012345678) — 1 guild(s)
Guild IDs: 987654321098765432
```

- **`1 guild(s)`** (or more) — the bot is in your server; nicknames and member lookups can work.
- **`0 guild(s)`** — the token in `.env` does not match a bot that is in your server. Re-invite using the URL above for **this** application, or fix `DISCORD_TOKEN`.
- Run **only one** bot process. Multiple copies with the same token cause `Unknown interaction` (10062) errors.

Keep the process running (terminal, `systemd`, `pm2`, Docker, etc.).

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal |
| `HTB_TOKEN` | Yes* | HTB app JWT used for `/link` (profile lookup + Playwright auth) |
| `DATABASE_PATH` | No | SQLite file path (default: `./data/bot.db`) |
| `GUILD_ID` | No | If set, `deploy-commands` registers commands only to this guild |
| `PW_CHANNEL` | No | Playwright browser channel (default: `chrome`) |

\* `HTB_TOKEN` is only required for `/link`. `/sync` and `/leaderboard` use the public Experience API.

### Obtaining `HTB_TOKEN`

You need a token from an authenticated HTB session (used like the web app’s `htb-token` in `localStorage`):

1. Log in at [app.hackthebox.com](https://app.hackthebox.com/).
2. Open browser DevTools → **Application** → **Local Storage** → `https://app.hackthebox.com`.
3. Copy the value of `htb-token`.

Alternatively, create an app token from [Account Settings](https://app.hackthebox.com/account-settings) if you use HTB app tokens.

---

## Usage

All commands are **guild-scoped**: each Discord server has its own linked members and leaderboard. If the bot is in multiple servers, run `/link` **in each server** where you want someone on the board — a link in one server does not carry over to another.

### `/link`

Link a Discord member to an HTB account.

| Option | Description |
|--------|-------------|
| `member` | Discord user to link |
| `htb_username` | HTB profile name (e.g. `Hoshtoo`) **or** numeric user ID (e.g. `1986668`) |

Example:

```
/link member:@hoshtoo htb_username:hoshtoo
```

This command may take 10–30 seconds while Playwright loads the HTB profile page. The bot acknowledges the command immediately, then performs HTB capture in the background.

**Display name:** `/link` records the member’s **server nickname** when set (from the slash command’s resolved member data, guild cache, or Discord REST). That value is stored as `server_nick` and shown on future leaderboards.

**Requirements:** Target HTB profile must be visible to the account that owns `HTB_TOKEN` (private profiles may fail with no `account_id`).

### `/sync`

Refresh XP for linked members using stored Experience API URLs (fast, no browser).

| Option | Description |
|--------|-------------|
| `member` | Optional — sync one user; omit to sync everyone linked in the server |

### `/leaderboard`

Fetch current XP for all linked members and post a ranked embed (top 10 shown).

**Display names:** For each linked member, the bot resolves the current **server display name** (nickname if set, otherwise global/display name) via the guild member cache or Discord API, then updates the database. Nickname changes in Discord are picked up on the next `/leaderboard` without re-linking.

Members linked **before** nickname support was added may still have empty `server_nick` rows — run `/link` once for those users to seed stored names, or rely on `/leaderboard` to refresh `discord_tag` after the first run.

| Option | Description |
|--------|-------------|
| `period` | Optional — `All time` (default), `This week`, or `This month` |
| `limit` | Optional — how many members to show (1–100, default **10**). Ignored if `show` is set |
| `show` | Optional — `Everyone linked` shows every linked member with rank (may truncate if the list exceeds Discord embed size) |

Examples:

```
/leaderboard
/leaderboard period:This week
/leaderboard period:This month
/leaderboard limit:25
/leaderboard show:Everyone linked
/leaderboard period:This week limit:50
```

**Period boundaries (UTC):**

- **This week** — Monday 00:00 UTC through now (ISO week)
- **This month** — 1st of the calendar month 00:00 UTC through now
- **All time** — Lifetime HTB XP total

Period leaderboards show **XP gained during that period** (current total minus baseline at period start). Run `/sync` regularly so snapshots stay accurate.

**Tracking caveat:** HTB only exposes lifetime XP. The bot records snapshots when you `/link`, `/sync`, or run `/leaderboard`. If no snapshot exists from before the period started, rankings use the first in-period snapshot as the baseline—so early weekly/monthly boards may undercount until history builds up.

### `/unlink`

Remove a member’s HTB link from this server.

| Option | Description |
|--------|-------------|
| `member` | Discord user to unlink |

---

## Project structure

```
htb-discord-bot/
├── scripts/
│   └── htb-render-profile.mjs   # Playwright profile capture (used by /link)
├── src/
│   ├── index.js                 # Bot entry point
│   ├── deploy-commands.js         # Slash command registration
│   ├── config.js
│   ├── db.js                    # SQLite schema & queries
│   ├── commands/                # Slash command handlers
│   ├── discord/                 # Guild warmup, nickname resolution at link & leaderboard
│   │   ├── display-name.js      # Live member display names (cache → REST → DB fallback)
│   │   ├── ensure-guild.js      # Guild cache warmup before leaderboard
│   │   ├── resolve-link-name.js # Nickname capture on /link
│   │   └── server-display-name.js
│   ├── leaderboard/             # Ranking + period delta logic
│   └── htb/                     # HTB API, capture, snapshots
├── .env.example
├── package.json
└── README.md
```

Data created at runtime (gitignored):

- `data/bot.db` — member links (`discord_tag`, `server_nick`), cached XP, and `xp_snapshots` history (90-day retention)
- `data/captures/` — temporary Playwright output (deleted after `/link`)

---

## Development

```bash
# Watch logs while testing
npm start

# Re-register commands after changing definitions
npm run deploy-commands
```

Command definitions live in `src/commands/definitions.js`.

Long-running commands (`/link`, `/sync`, `/leaderboard`) are **deferred immediately** in `src/index.js` so Discord receives an acknowledgement within 3 seconds before HTB or member API work runs.

### Standalone profile capture script

You can run the Playwright script directly (debugging / inspection):

```bash
export HTB_TOKEN='your-token'
node scripts/htb-render-profile.mjs 1986668 ./output-dir
```

Outputs: `profile.html`, `profile.png`, `profile.txt`, `api-captures.json`.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Slash commands don’t appear | Run `npm run deploy-commands`; for testing, set `GUILD_ID` |
| Startup shows **`0 guild(s)`** | Re-invite the bot using the OAuth2 URL for the **same** app as `DISCORD_TOKEN`; confirm the token was copied from **Bot → Token**, not a different application |
| Leaderboard shows **global name**, not server nick | Enable **Server Members Intent**, re-invite the bot, run `/link` again (or `/leaderboard` after the bot is in the server with intent enabled) |
| `Unknown interaction` (10062) on `/link` or `/sync` | Discord requires a reply within **3 seconds**. Stop duplicate bot processes (`pkill -f "node.*htb-discord-bot"`); run only one `npm start`. If it happens occasionally, wait for a running `/leaderboard` to finish before `/link`, or retry the command once |
| `Unknown Guild` (10004) on member fetch | Bot is not in the server or wrong token; fix invite + `DISCORD_TOKEN` until startup logs `1 guild(s)` |
| `/link` fails immediately on Playwright | Run `npm run install-browser`; ensure Chrome is installed |
| `HTB user "…" not found` | Check spelling; try numeric HTB user ID from profile URL |
| `no account_id` on link | HTB profile may be private; use a token that can view the profile |
| `Experience API failed` on sync | Re-run `/link` for that member to refresh the stored URL |
| Weekly/monthly board empty or low | Run `/sync` to record snapshots; period boards need history since period start |
| Bot online but commands missing | Re-invite with `applications.commands` scope; run `npm run deploy-commands` after updates |

---

## Disclaimer

This project is not affiliated with Hack The Box or Discord. Use responsibly and comply with HTB and Discord terms of service. API behavior may change without notice.

