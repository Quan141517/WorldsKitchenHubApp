# World's Kitchen Hub App

This folder is the real application foundation for World's Kitchen Hub.

The finished static layout remains in `../WorldsKitchenHub` so it stays safe while the production app is built here.

## First Run

```powershell
cd ".\WorldsKitchenHubApp"
npm.cmd install
npm.cmd run dev
```

Then open `http://localhost:3000`.

## Build Order

1. Discord OAuth login. Done locally.
2. Discord server role sync. Done locally.
3. Local profile history for signed-in Discord users. Done locally.
4. Supabase database tables and durable `hub_state` persistence. Connected with local fallback.
5. Resource/category/admin screens migrated from the prototype. Done locally.
6. Activity logs with real created-by ownership. Done locally.
7. Roblox profile linking and avatars. Next external integration.

## Local Data vs Supabase

The app saves live test data to `data/hub-data.json` when Supabase is not configured, so the layout and permissions can be tested locally without a database.

Discord login now also updates local profile history inside `data/hub-data.json`. Roblox usernames can be stored locally for testing, but real Roblox verification is not connected yet.

Before every local data write, the app keeps recent JSON backups in `data/backups`. When Supabase is configured, the app writes the same Hub data to Supabase and keeps a local copy as a safety backup.

Supabase is enabled when these variables are filled:

```powershell
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
ROBLOX_GROUP_ID=
ROBLOX_PLACE_ID=
ROBLOX_UNIVERSE_ID=
ROBLOX_TRACKER_SECRET=
```

Run `supabase/schema.sql` in the Supabase SQL editor first. The most important table for the current app is `hub_state`, which stores the whole Hub state as durable JSONB while the app is still evolving.

Then run `supabase/seed.sql` if you want the relational scaffold tables to contain the same default categories, quick links, weekly assignments, and admin levels. The first time the configured app reads from Supabase, it automatically copies your current local `data/hub-data.json` into `hub_state` if no Supabase state exists yet.

If your Supabase project already existed before Roblox public-readiness fields were added, run `supabase/migration-2026-06-21-roblox-public-readiness.sql` once in the SQL editor.

`SESSION_SECRET` signs the Discord session cookie so users cannot edit their role locally. If it is omitted, the app falls back to `DISCORD_CLIENT_SECRET` for local development.

For production, `SESSION_SECRET` is required. Generate a long random value, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`ROBLOX_GROUP_ID` is used by username suggestions in Corporate Lookup and activity log forms. When it is set, suggestions are based on users returned by the Roblox group members API, so a staff member does not need to have connected Discord on the Hub before appearing in lookup.

When `ROBLOX_GROUP_ID` is set, linked Roblox profiles must also be members of the group. This prevents a signed-in Discord user from linking a random Roblox account outside World's Kitchen.

`ROBLOX_PLACE_ID` and `ROBLOX_UNIVERSE_ID` identify the Roblox experience for the future in-game minutes tracker.

`ROBLOX_TRACKER_SECRET` protects the Roblox minutes endpoint. Keep it private and only use it from Roblox server-side scripts.

## Important IDs

- Discord guild: `1452614312798584852`
- Owner Discord user: `1455543306300948611`
- Roblox group: `34815655`
- Roblox place: `90027902734040`
- Roblox universe: `10109383536`

## Roblox Minutes Endpoint

Roblox Studio can submit minutes with:

```http
POST /api/roblox/minutes
x-roblox-tracker-secret: <ROBLOX_TRACKER_SECRET>
content-type: application/json

{
  "robloxUserId": "123",
  "robloxUsername": "PlayerName",
  "minutes": 5,
  "placeId": "90027902734040",
  "universeId": "10109383536"
}
```

The app stores these entries in `activityMinuteEntries`; staff activity views add them to manually credited shift minutes.

A starter Roblox server script is available at `roblox/MinutesTracker.server.lua`. Put it in `ServerScriptService`, replace `HUB_BASE_URL` with the deployed Hub URL, and replace `TRACKER_SECRET` with `ROBLOX_TRACKER_SECRET`.

## Roblox Rank Mapping

- World's Kitchen Team: Trainee `5` through Head Operator `20`
- Supervision Team: Assistant Supervisor `25` through General Manager `40`
- Management Team: Director Intern `45` through Head Director `60`
- Corporate Team: Corporate Intern `65` through Head Corporate `80`
- Leadership Team: Chief Human Resources Officer `120` through President `255`
- Owner: treated as `255`

## Public Launch Checklist

Before the Hub is shared with staff, check these items:

1. Deploy the Next.js app to a real host such as Vercel so it stays online without your computer running.
2. Add all environment variables from `.env.example` to the host.
3. Set the Discord OAuth redirect URL to the deployed callback URL: `https://your-domain.com/api/auth/discord/callback`.
4. Run `supabase/schema.sql`, then optionally `supabase/seed.sql`.
5. Open `/api/health` on the deployed site and confirm every required check is `true`.
6. Put `roblox/MinutesTracker.server.lua` in Roblox Studio `ServerScriptService`, then replace `HUB_BASE_URL` and `TRACKER_SECRET`.
7. Test with three accounts: one non-staff/customer, one normal staff member, and one leadership/admin account.

`/api/health` returns configuration checks plus a `missing` list. It does not reveal secret values.
