# Getting Started (from scratch)

A complete walkthrough from a fresh machine to a running bot that posts HTB
own/completion notifications. Works on **Windows, macOS, and Linux**.

If you just want the short version, see the [Quick start](../README.md#quick-start)
in the main README. This guide is the beginner-friendly, step-by-step path.

---

## 1. Install prerequisites

### Node.js — use an LTS version (20 or 22)

> [!IMPORTANT]
> Use **Node 20 or 22 LTS**, not the newest/odd-numbered release (e.g. 23/24).
> The bot depends on `better-sqlite3`, which ships prebuilt binaries for LTS
> versions. On a too-new Node it tries to **compile from source**, which then
> needs Python + C++ build tools and usually fails. Sticking to LTS avoids all of
> that — no Python, no compiler.

The easiest way to manage Node versions:

**Windows** (PowerShell):

```powershell
winget install CoreyButler.NVMforWindows
# Close and reopen PowerShell (as Administrator), then:
nvm install 22
nvm use 22
node -v        # should print v22.x
```

**macOS / Linux**:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Reopen your terminal, then:
nvm install 22
nvm use 22
node -v        # should print v22.x
```

Already have Node 20 or 22 installed system-wide? You can skip nvm.

### Git

- **Windows:** `winget install Git.Git`
- **macOS:** `brew install git` (or Xcode Command Line Tools)
- **Linux:** `sudo apt install git` (Debian/Ubuntu)

### (Optional) Google Chrome / Chromium

Only needed for the `/link` command (Playwright). Notifications, `/sync`,
`/leaderboard`, and `/mog` don't need it.

---

## 2. Get the code

```bash
git clone https://github.com/Hoshtoo/htb-xp-discord-bot.git
cd htb-xp-discord-bot
```

---

## 3. Install dependencies

```bash
npm install
```

On Node 20/22 this pulls prebuilt binaries for `better-sqlite3` and
`@resvg/resvg-js` — no compiler needed. (Optionally `npm run install-browser` to
set up Playwright's Chrome if you plan to use `/link`.)

---

## 4. Create the Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   → **New Application** → name it.
2. **Bot** (left sidebar) → **Reset Token** → **Copy**. This is your
   `DISCORD_TOKEN` (shown once).
3. On the same Bot page, enable **Privileged Gateway Intents → Server Members
   Intent**, and **Save**.
4. Invite the bot: **OAuth2 → URL Generator** → scopes **`bot`** and
   **`applications.commands`** → Bot Permissions: **View Channels**, **Send
   Messages**, **Embed Links**, **Attach Files** → open the generated URL and add
   it to your server.

> The token you copy in step 2 **must** belong to the same application you invite
> in step 4. If the bot logs `0 guild(s)` at startup, they don't match.

---

## 5. Get your HTB token

1. Log in at [app.hackthebox.com](https://app.hackthebox.com/).
2. Either:
   - **App token:** Profile → **Profile Settings → App Tokens → Create App
     Token**, copy it; **or**
   - **Session token:** DevTools → **Application → Local Storage →
     `https://app.hackthebox.com`** → copy the `htb-token` value.

This is your `HTB_TOKEN`. Treat it like a password — it's required for `/link`,
`/mog`, and the notification watcher. HTB tokens expire; if things start
returning `401`, get a fresh one and restart the bot.

---

## 6. Configure `.env`

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

Edit `.env` and set at minimum:

```
DISCORD_TOKEN=your_discord_token
HTB_TOKEN=your_htb_token
```

For instant command registration in one server, also add your server ID
(enable Discord **Developer Mode**, right-click the server → **Copy Server ID**):

```
GUILD_ID=your_server_id
```

(No quotes, no spaces around `=`. `.env` is gitignored, so it's never committed.)

---

## 7. Register slash commands

```bash
npm run deploy-commands
```

- With `GUILD_ID` set → commands appear in that server immediately.
- Without it → global commands (can take up to an hour to propagate).

Re-run this any time you change command definitions.

---

## 8. Start the bot

```bash
npm start
```

You should see something like:

```
Logged in as YourBot#1234 (123…) — 1 guild(s)
[scheduler] Period baseline sync enabled ...
[notify] Own-notification watcher enabled (polling every 15 min)
```

- `1 guild(s)` (or more) — good.
- `0 guild(s)` — the token doesn't match a bot that's in your server (redo step 4
  for the right application).

---

## 9. Turn on notifications

In Discord:

```
/notify channel #htb-pwns      # sets the channel and enables notifications
/link @member their_htb_user   # link each member you want watched
/notify test type:prolab       # preview a real recent solve (optional)
```

That's it. From now on, new owns (machine user/root, challenge, Sherlock, Pro
Lab flag, Fortress flag) post to the channel **automatically within ~15 minutes**.

- All linked members are watched by default; anyone can `/notify optout`.
- Existing history is silently seeded on first poll, so the channel won't get
  flooded with old solves — only new ones are announced.

See [NOTIFICATIONS.md](NOTIFICATIONS.md) for the full feature reference.

---

## 10. Keep it running

Run **one** process per bot token. Options:

- **pm2:** `npm i -g pm2 && pm2 start src/index.js --name htb-bot && pm2 save`
- **systemd (Linux):** see [Production deployment](../README.md#production-deployment)
  in the README.
- **Windows:** run in a persistent terminal, or use a tool like NSSM to run it as
  a service.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm install` fails building `better-sqlite3` / "could not find Python" | You're on a too-new Node. Switch to Node 20/22 LTS (step 1), delete `node_modules`, `npm install` again. |
| Bot logs `0 guild(s)` | `DISCORD_TOKEN` is for a different app than the one you invited. Re-invite the correct application. |
| Slash commands don't appear | Run `npm run deploy-commands`; set `GUILD_ID` for instant registration. |
| `/link` or `/mog` returns `401` | `HTB_TOKEN` expired — get a fresh one and restart. |
| Notifications never post | Check `/notify status`: channel set + enabled, you're linked and not opted out. Remember only owns *after* the first poll are announced. |
| Test image shows nothing for a challenge | Challenge category icons are SVG; the bot rasterizes them, but some have no usable image — text-only embed is expected. |
