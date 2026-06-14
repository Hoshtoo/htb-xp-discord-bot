# HTB Own Notifications

Announce when linked members complete content on Hack The Box — machines
(user/root), challenges, Sherlocks, Pro Lab flags, and Fortress flags — with a
thumbnail of the box/lab in the embed.

> Example: **ejee got root on Imagery** with the machine avatar attached.

## How it works

The bot polls each linked member's HTB activity feed
(`GET https://labs.hackthebox.com/api/v5/user/profile/activity/{userId}`) every
~15 minutes. That single feed returns owns across every content type:

| HTB `type` | Notification |
|------------|--------------|
| `user` | *X got user on `<machine>`* |
| `root` | *X got root on `<machine>`* |
| `challenge` | *X solved the challenge `<name>`* |
| `sherlock` | *X solved the Sherlock `<name>`* |
| `prolab` | *X owned a flag in `<pro lab>`* (one per flag, incl. mini Pro Labs) |
| `fortress` | *X owned a flag in `<fortress>`* (one per flag) |

First blood owns (machines/challenges) are highlighted in red.

### No historical spam

The first time the bot sees a member, it **seeds** their feed silently —
recording existing owns without posting them. Only owns that happen *after*
seeding are announced. A per-event dedupe ledger (`posted_events`) guarantees
each own is announced at most once, even across restarts or overlapping polls.

### Thumbnails

Each activity item usually includes an `avatar` image URL, used directly as the
embed image. Discord can't render SVGs, so for items whose feed image is an SVG
(some challenge categories, Fortress logos) the bot falls back to a v4 detail
endpoint to find a PNG/JPG:

- Machines → `/machine/profile/{id}`
- Pro Labs → `/prolab/{id}/info`
- Fortresses → `/fortress/{id}`
- Sherlocks → `/sherlocks/{id}/info`

Square avatars (machines/challenges/Sherlocks) are shown as a thumbnail; wide
Pro Lab/Fortress covers are shown as the large embed image. Lookups are cached
for 6 hours.

## Setup

1. Make sure `HTB_TOKEN` is set in `.env` (the watcher uses it to read activity
   feeds).
2. Invite the bot with permission to **send messages** in the target channel.
3. In your server, run:

   ```
   /notify channel #htb-pwns
   ```

   This sets the channel **and** enables notifications. All linked members are
   watched by default.

## Commands

| Command | Who | Description |
|---------|-----|-------------|
| `/notify channel #channel` | Manage Server | Set the announcement channel and enable notifications |
| `/notify enable` | Manage Server | Enable notifications (channel must be set) |
| `/notify disable` | Manage Server | Disable notifications for the server |
| `/notify status` | Anyone | Show settings, watched-member count, and your opt status |
| `/notify optout` | Anyone | Stop your own owns from being announced |
| `/notify optin` | Anyone | Resume announcing your owns |
| `/notify test` | Manage Server | Post a sample notification to the channel |

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `NOTIFY_POLL_INTERVAL_MS` | `900000` (15 min) | How often (ms) to poll HTB for new owns |

## Notes / caveats

- HTB's API is **unofficial** and may change; the watcher logs and skips on
  errors rather than crashing.
- Only the first page (50 items) of each member's feed is read per poll. A member
  completing more than 50 items within one poll interval could have the overflow
  missed (rare).
- A flood cap of 20 announcements per member per poll prevents channel spam after
  big batches; capped-over events are not re-announced.

## Known items / to investigate

- **Pro Lab / Fortress "Points":** the embed shows the `points` value HTB returns
  for each flag event (e.g. a Dante flag reports `points: 10`). The exact meaning
  of these points for Pro Labs/Fortresses — and how they relate to overall XP —
  needs more investigation. If they turn out to be misleading, the "Points" field
  can be hidden for `prolab`/`fortress` types in `src/discord/own-embed.js`.
