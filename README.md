# HTB Discord Bot

A Discord bot that links server members to [Hack The Box](https://www.hackthebox.com/) accounts and displays a **per-server XP leaderboard**. Each guild keeps its own list of linked members.

## Features

- **`/link`** — Associate a Discord member with an HTB username (or numeric user ID)
- **`/sync`** — Refresh XP for linked members from stored HTB Experience API URLs
- **`/leaderboard`** — All-time, weekly, or monthly XP rankings (per-server)
- **`/mog`** — Head-to-head HTB stat comparison vs another linked member (rank-gated)
- **`/unlink`** — Remove a member's link and their XP snapshot history for that server
- Per-guild SQLite storage with XP snapshot history (no external database required)
- Username resolution via HTB search API (no need to look up numeric IDs manually)
- **Cross-server link reuse** — if the same Discord user is already linked elsewhere, a second `/link` skips Playwright when the stored Experience URL still works
- **Scheduled baseline sync** — auto-syncs all linked members at week/month boundaries (UTC) for period leaderboards
- **Server nicknames** on leaderboards (refreshed on each `/leaderboard`, stored on `/link`)

## How it works

| Step | What happens |
|------|----------------|
| **Link** | Resolves HTB user → reuses a verified Experience URL from another server when possible, else runs headless Chrome (Playwright) to capture profile API calls → verifies the Experience v1 URL returns XP → stores `/api/experience/v1/account/{uuid}` |
| **Sync / Leaderboard** | Fetches XP from stored URLs directly (public Experience API, no browser) |
| **Mog** | Fetches live HTB profile progress via authenticated HTB API + stored Experience URL for XP |
| **XP history** | Each sync/leaderboard/link records a snapshot; weekly/monthly boards compare current total vs period start |
| **Display names** | `/link` stores server nickname + display label; `/leaderboard` re-fetches live names from Discord and updates the database |
| **Scheduler** | Every minute, checks whether the ISO week or calendar month just started (UTC); if so, syncs all linked members across all guilds and records baselines |

`/link` is the only command that uses Playwright. `/link` and `/mog` require a valid `HTB_TOKEN`. Chrome (or Chromium) must be installed on the host for `/link`.

## Requirements

- **Node.js** 18 or newer
- **Google Chrome** (or Chromium) for Playwright during `/link`
- A **Discord bot** with the `applications.commands` scope
- An **HTB app token** for `/link` and `/mog` (see below)

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

On **ARM64 (Raspberry Pi)**, Playwright’s Chrome install often fails — install system Chromium and set `PW_EXECUTABLE_PATH=/usr/bin/chromium` in `.env` instead (see [Raspberry Pi / ARM64](#raspberry-pi--arm64)).

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
[scheduler] Period baseline sync enabled (weekly: Monday 00:00 UTC, monthly: 1st 00:00 UTC)
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
| `HTB_TOKEN` | Yes | HTB app JWT — required at startup; used by `/link` (search, profile lookup, Playwright auth) and `/mog` (live profile stats) |
| `DATABASE_PATH` | No | SQLite file path (default: `./data/bot.db`) |
| `GUILD_ID` | No | If set, `deploy-commands` registers commands only to this guild |
| `PW_CHANNEL` | No | Playwright browser channel (default: `chrome`) |
| `PW_EXECUTABLE_PATH` | No | Path to a system browser binary instead of Playwright-managed Chrome (common on **ARM64 / Raspberry Pi**, e.g. `/usr/bin/chromium`) |

`/sync` and `/leaderboard` use the public Experience API only (no `HTB_TOKEN` in those requests), but the bot still **will not start** without `HTB_TOKEN` set in `.env`.

### Obtaining `HTB_TOKEN`

You need a token from an authenticated HTB session (used like the web app’s `htb-token` in `localStorage`):

1. Log in at [app.hackthebox.com](https://app.hackthebox.com/).
2. Open browser DevTools → **Application** → **Local Storage** → `https://app.hackthebox.com`.
3. Copy the value of `htb-token`.

Alternatively, create an app token from [Account Settings](https://app.hackthebox.com/account-settings) if you use HTB app tokens.

**Token expiry:** If `/link` or `/mog` returns HTTP 401 errors, log in again and copy a fresh `htb-token`. Restart the bot after updating `.env`.

---

## Usage

All commands are **guild-scoped** and **server-only** (DMs are rejected). Each Discord server has its own linked members and leaderboard. If the bot is in multiple servers, run `/link` **in each server** where you want someone on the board — a link in one server does not carry over to another (though the bot may reuse a verified Experience URL from another server during `/link`).

### Commands at a glance

| Command | Deferred? | Needs `HTB_TOKEN`? | Summary |
|---------|-----------|-------------------|---------|
| `/link` | Yes | Yes (API + browser) | Link Discord member ↔ HTB account; 10–30s when Playwright runs |
| `/sync` | Yes | No (public XP API) | Refresh XP for one member or everyone linked in this server |
| `/leaderboard` | Yes | No | Ranked embed; optional period, limit, or show-all |
| `/mog` | Yes | Yes (profile stats) | Head-to-head stat flex vs another linked member |
| `/unlink` | No | No | Remove link + snapshot history for this server |

Long-running commands are **deferred immediately** in `src/index.js` (before handler logic) so Discord always gets an acknowledgement within 3 seconds.

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

This command may take 10–30 seconds while Playwright loads the HTB profile page. The bot defers the reply immediately, then performs HTB capture in the background.

**Cross-server reuse:** If the same Discord user is already linked in another server with a working Experience URL and XP, `/link` in a new server reuses that URL (no browser) and replies with *(Reused verified HTB link from another server — no browser capture needed.)*.

**Verification:** `/link` only succeeds when the bot can fetch valid XP from the Experience v1 account endpoint. If HTB has not provisioned Experience for the account, linking fails with guidance to confirm XP is visible on the HTB website.

**Display name:** `/link` records the member’s **server nickname** when set (from the slash command’s resolved member data, guild cache, or Discord REST). That value is stored as `server_nick` and shown on future leaderboards.

**Requirements:** Target HTB profile must be visible to the account that owns `HTB_TOKEN` (private profiles may fail with no `account_id`). A successful link reply includes an **XP:** line when Experience data was verified.

### `/sync`

Refresh XP for linked members using stored Experience API URLs (fast, no browser).

| Option | Description |
|--------|-------------|
| `member` | Optional — sync one user; omit to sync everyone linked in the server |

If you sync a user who is linked in **another** server but not this one, the bot hints that you need `/link` in **this** server.

### `/leaderboard`

Fetch current XP for all linked members and post a ranked embed (top 10 shown).

**Display names:** For each linked member, the bot resolves the current **server display name** (nickname if set, otherwise global/display name) via the guild member cache or Discord API, then updates the database. Nickname changes in Discord are picked up on the next `/leaderboard` without re-linking.

Members linked **before** nickname support was added may still have empty `server_nick` rows — run `/link` once for those users to seed stored names, or rely on `/leaderboard` to refresh `discord_tag` after the first run.

Members with sync errors appear on `/leaderboard` as **XP unavailable** with the error reason (e.g. `no period data yet (run /sync)` for weekly/monthly, or the Experience HTTP status).

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

The bot also **auto-syncs all linked members** at the start of each ISO week (Monday 00:00 UTC) and calendar month (1st 00:00 UTC) to record baselines for weekly/monthly boards. If the bot was offline at a boundary, it catches up on the next startup.

**Tracking caveat:** HTB only exposes lifetime XP. The bot records snapshots when you `/link`, `/sync`, or run `/leaderboard`. If no snapshot exists from before the period started, rankings use the first in-period snapshot as the baseline—so early weekly/monthly boards may undercount until history builds up.

### `/unlink`

Remove a member’s HTB link from this server. Also deletes their `xp_snapshots` rows for this guild. Does not affect links in other Discord servers.

| Option | Description |
|--------|-------------|
| `member` | Discord user to unlink |

If the member is not linked, the bot replies ephemerally (only you see it). This command is **not** deferred — it responds immediately.

### `/mog`

Head-to-head HTB stat comparison to flex on another linked member and motivate them to grind.

| Option | Description |
|--------|-------------|
| `member` | Linked Discord member to compare against (you are the challenger) |

**Rules:**

- Both you and the target must be **linked in this server** with working Experience URLs.
- Both must appear on the **all-time server leaderboard** (`/leaderboard`).
- Target must be **ranked above you** (any rank), **or** within **5 ranks below** you on the all-time leaderboard (e.g. #4 can mog #1–#3, or #5–#9, but not #10).
- Categories are shown and scored when **at least one** player has a value **greater than 0** (rows where both are 0 are skipped).
- You win if you beat them on a **strict majority** of compared categories (`wins > losses`; ties on a row count as not a win).

**Compared stats (when at least one player > 0):** XP, total machine solves, Easy/Medium/Hard/Insane machine counts, challenge solves, sherlock solves, Pro Lab solves, Mini Pro Lab solves, Pro Lab progress %, Mini Pro Lab progress %.

**Outcome:**

- Majority of compared rows won → green checks on winning rows, large **`MOGGEDDDDDDD`** verdict in a second embed below the stats (target gets **@mentioned**)
- No majority (including ties) → red X on losing rows, large **`MOG FAILED`** verdict in the second embed

Requires `HTB_TOKEN` (same as `/link`) to fetch live profile progress from HTB.

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
│   ├── mog/                     # Mog comparison + embed formatting
│   ├── scheduler/               # Weekly/monthly baseline auto-sync
│   └── htb/                     # HTB API, capture, snapshots
├── .env.example
├── package.json
└── README.md
```

Data created at runtime (gitignored):

- `data/bot.db` — SQLite with:
  - `members` — per-guild links (`discord_tag`, `server_nick`, HTB ids, `experience_url`, `last_xp`)
  - `xp_snapshots` — XP history for period leaderboards (**90-day retention**, pruned after monthly baseline sync)
  - `scheduler_runs` — last run time for weekly/monthly baseline jobs
- `data/captures/` — temporary Playwright output (deleted after `/link`)

---

## Production deployment

Run **one** bot process per `DISCORD_TOKEN`. Duplicate processes cause `Unknown interaction` (10062) errors.

### systemd (Linux)

Example unit at `/etc/systemd/system/htb-discord-bot.service`:

```ini
[Unit]
Description=HTB Discord Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/htb-discord-bot
EnvironmentFile=/path/to/htb-discord-bot/.env
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now htb-discord-bot
sudo systemctl status htb-discord-bot
journalctl -u htb-discord-bot -f   # follow logs (scheduler + sync errors)
```

After pulling code or editing `.env`:

```bash
sudo systemctl restart htb-discord-bot
npm run deploy-commands   # if slash command definitions changed
```

### Raspberry Pi / ARM64

`npm run install-browser` often fails on ARM64. Use the system Chromium instead:

```bash
# In .env
PW_EXECUTABLE_PATH=/usr/bin/chromium
```

Install Chromium if needed (`sudo apt install chromium-browser` or your distro’s package). You can skip `npm run install-browser` when `PW_EXECUTABLE_PATH` is set.

---

## Development

```bash
# Watch logs while testing
npm start

# Re-register commands after changing definitions
npm run deploy-commands
```

Command definitions live in `src/commands/definitions.js`.

Long-running commands (`/link`, `/sync`, `/leaderboard`, `/mog`) are **deferred before the handler runs** in `src/index.js` so Discord receives an acknowledgement within 3 seconds before HTB or member API work runs.

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
| Bot exits on start: `Missing required environment variable` | Set `DISCORD_TOKEN` and `HTB_TOKEN` in `.env` (both required) |
| Slash commands don’t appear | Run `npm run deploy-commands`; for testing, set `GUILD_ID` |
| Command used in DMs | Bot only works inside a server; use a guild channel |
| Startup shows **`0 guild(s)`** | Re-invite the bot using the OAuth2 URL for the **same** app as `DISCORD_TOKEN`; confirm the token was copied from **Bot → Token**, not a different application |
| Leaderboard shows **global name**, not server nick | Enable **Server Members Intent**, re-invite the bot, run `/link` again (or `/leaderboard` after the bot is in the server with intent enabled) |
| `Unknown interaction` (10062) | Discord requires a reply within **3 seconds**. Stop duplicate bot processes (`pkill -f "node.*htb-discord-bot"` or `systemctl stop` the extra service); run only one instance. Avoid overlapping `/link` commands; retry once |
| Command stuck on **“thinking…”** forever | Usually a duplicate bot instance or a reply before defer finished — ensure only one process runs and you are on the latest code (handlers must run **after** `deferReply`) |
| `Unknown Guild` (10004) on member fetch | Bot is not in the server or wrong token; fix invite + `DISCORD_TOKEN` until startup logs `1 guild(s)` |
| `/link` fails immediately on Playwright | Run `npm run install-browser`; ensure Chrome is installed. On ARM/Pi set `PW_EXECUTABLE_PATH=/usr/bin/chromium` |
| `HTB user "…" not found` | Check spelling; try numeric HTB user ID from profile URL |
| `no account_id` on link | HTB profile may be private; use a token that can view the profile |
| `Could not verify HTB Experience API` on link | HTB has no working Experience record for that account yet — see [Experience API failures](#experience-api-failures-on-sync) |
| `HTB user search failed` / `HTB API failed (HTTP 401)` | Refresh `HTB_TOKEN` from an active HTB browser session (tokens expire) |
| `Experience API failed` on sync | See [Experience API failures](#experience-api-failures-on-sync) below; often re-run `/link` after the member’s HTB Experience account is active |
| `URL is not a valid Experience account endpoint` / `xp-earned` in DB | Bad stored URL from an older bot version — re-run `/link` in that server |
| `/sync` — “not linked in this server” but linked elsewhere | Run `/link` in **this** server (links are per-guild) |
| Weekly/monthly board empty or low | Run `/sync` to record snapshots; period boards need history since period start. The bot also auto-syncs at Monday 00:00 UTC and the 1st of each month UTC for baselines |
| Scheduler logs failures | Check `journalctl -u htb-discord-bot`; failed members usually need `/link` or have Experience 404 — same as manual `/sync` |
| Bot online but commands missing | Re-invite with `applications.commands` scope; run `npm run deploy-commands` after updates |
| `/mog` — too far apart on leaderboard | You can mog anyone ranked above you; targets below you must be within 5 ranks |
| `/mog` — cannot mog yourself | Pick another linked member |
| `/mog` — MOG FAILED with close stats | You need a strict majority of wins on shared non-zero categories; ties on a row are not wins |
| `/mog` — no comparable stats | Neither player has a non-zero value in any category |
| `/mog` — not on leaderboard | Run `/link` and `/sync` so both users have XP on the all-time board |
| `/mog` — Discord bot target | Bots cannot be mogged; pick a linked human member |
| `/mog` — not linked / unlinked target | Both challenger and target must be linked in **this** server with stored Experience URLs |
| `/mog` — HTB API timeout or HTTP error | HTB may be slow or `HTB_TOKEN` invalid; retry or refresh token (20s timeout per request) |

### Link and sync pipeline

Understanding where failures happen makes broken links easier to diagnose:

| Step | Command / code | What it does |
|------|----------------|--------------|
| 1 | `/link` → `resolveHtbUser` | Looks up HTB username/ID via search + profile basic API |
| 2 | `/link` → Playwright capture | Loads the HTB profile page and records API calls |
| 3 | `/link` → `parseExperienceFromCaptures` | Picks an Experience v1 **account** URL from captured API traffic (ignores `/xp-earned` subpaths) |
| 4 | `/link` → `fetchExperiencePublic` | Verifies the URL returns XP before saving |
| 5 | `/link` → DB upsert | Stores `experience_url`, `htb_account_id`, and `last_xp` |
| 6 | `/sync`, `/leaderboard`, scheduler | Fetches XP from the stored Experience URL (no browser) |

If step 1 fails, you see `HTB user "…" not found` or `no account_id`. If step 3–4 fail verification, `/link` errors out and **does not** save a broken row. A successful reply always includes an **XP:** line when Experience data was verified.

### Experience API failures on sync

**Symptom:** `/sync` or the scheduled baseline sync logs `Experience API failed (HTTP 404)` for one member, while others sync fine.

**What it means:** The bot stored an Experience v1 URL like:

```
https://labs.hackthebox.com/api/experience/v1/account/{account_uuid}
```

HTB’s profile API returns that `account_id`, but the Experience API returns **404** for that UUID. The bot cannot invent XP data — HTB must serve a JSON response at that endpoint.

**How to confirm:**

1. Check the member row in `data/bot.db` — `last_xp` is often `null` and there are no `xp_snapshots` rows.
2. Re-run `/link` for the member. Current versions fail at link time if Experience cannot be verified; older rows may exist without working XP.
3. Optionally run the Playwright debug script (replace with their HTB numeric user ID):

```bash
export HTB_TOKEN='your-token'
node scripts/htb-render-profile.mjs 169463 ./debug-output
```

Inspect `debug-output/api-captures.json` for `experience/v1/account/{uuid}` entries. A **404** on the target user’s UUID (while a **200** on the token owner’s UUID is normal) means HTB has no Experience record for that account yet.

**Common causes (HTB-side):**

- The member’s Experience / XP profile was never provisioned on HTB (legacy account, not migrated, etc.).
- The member needs to log in at [app.hackthebox.com](https://app.hackthebox.com) and confirm XP/level appears on their own profile page.
- HTB backend inconsistency: profile basic returns `account_id`, but Experience v1 does not serve data for it.

**What to do:**

1. Have the member open their HTB profile in a browser while logged in as themselves. If XP/level does not appear, the bot cannot track them until HTB enables Experience for that account.
2. If XP **does** appear on HTB but sync still 404s, treat it as an HTB support issue (profile `account_id` vs Experience service mismatch).
3. Once HTB serves their Experience API, run `/link` again for that member to refresh the stored URL.

**Bot behavior note:** Current versions **verify** the Experience endpoint before saving. `/link` fails if no candidate URL returns valid XP. Older database rows from previous versions may still have bad URLs — re-run `/link` to refresh them.

### Linking the same Discord user on multiple servers

Links are **per server** — run `/link` in each Discord server where you want someone on the leaderboard. A link in one server does not automatically apply to another.

**If `/link` works in server A but fails or `/sync` fails in server B:**

1. Confirm the bot is invited to server B (`startup` logs should list that guild ID).
2. Run `/link` again **in server B** (not server A). Each server needs its own link row.
3. If you already linked successfully in another server, the bot now **reuses the verified Experience URL** from that server when possible — the second `/link` should be fast and skip Playwright.
4. Avoid running `/link` on multiple servers at the exact same time; wait for the first command to finish (~10–30s) to prevent `Unknown interaction` errors.
5. Check `data/bot.db` for a bad `experience_url` ending in `/xp-earned` — that breaks sync. Re-run `/link` in that server after updating the bot.

---

## Disclaimer

This project is not affiliated with Hack The Box or Discord. Use responsibly and comply with HTB and Discord terms of service. API behavior may change without notice.

