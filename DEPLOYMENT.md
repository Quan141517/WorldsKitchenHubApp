# World's Kitchen Hub Deployment

This app should be hosted on a server platform. Your computer only needs to stay on for local development.

## Recommended Hosting

Use Vercel for the Next.js app and Supabase for saved data.

## Required Environment Variables

Set these in the hosting provider:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://your-domain.com/api/auth/discord/callback
DISCORD_GUILD_ID=1452614312798584852
OWNER_DISCORD_USER_ID=1455543306300948611
SESSION_SECRET=
ROBLOX_GROUP_ID=34815655
ROBLOX_PLACE_ID=90027902734040
ROBLOX_UNIVERSE_ID=10109383536
ROBLOX_TRACKER_SECRET=
```

Generate `SESSION_SECRET` and `ROBLOX_TRACKER_SECRET` as long random values.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Supabase

1. Run `supabase/schema.sql`.
2. If the database already existed, run `supabase/migration-2026-06-21-roblox-public-readiness.sql`.
3. Optionally run `supabase/seed.sql`.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` private. It must only be used by the server.

## Discord

In the Discord developer portal, add the production redirect URL:

```text
https://your-domain.com/api/auth/discord/callback
```

Keep the local redirect too if you still test locally:

```text
http://localhost:3000/api/auth/discord/callback
```

## Roblox Minutes Tracker

1. Put `roblox/MinutesTracker.server.lua` in Roblox Studio under `ServerScriptService`.
2. Replace `HUB_BASE_URL` with the deployed site URL.
3. Replace `TRACKER_SECRET` with the same value as `ROBLOX_TRACKER_SECRET`.
4. Enable HTTP requests for the Roblox experience.

## Final Checks

Open these after deployment:

- `/api/health`: confirms configuration without showing secret values.
- `/api/roblox/minutes`: confirms the tracker endpoint is online.

Then test with:

- a customer or non-staff account,
- a World's Kitchen staff member,
- a Management or Corporate member,
- a Leadership or Owner account.
