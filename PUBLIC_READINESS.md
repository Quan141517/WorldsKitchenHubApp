# Public Readiness

This is the practical list before World's Kitchen Hub is opened to staff.

## Already Working

- Discord OAuth login.
- Discord role based access.
- Owner-only access preview.
- Categories, resources, category links, announcements, recovery bin, admin levels, admin grants.
- Leadership and admin permissions with server-side API checks.
- Staff activity layout, logs, assignments, top performers, lookup.
- Roblox group username suggestions for lookup and logs.
- Roblox profile linking restricted to members of the configured Roblox group.
- Roblox avatar/display profile support.
- Roblox minutes endpoint protected by `ROBLOX_TRACKER_SECRET`.
- Supabase durable `hub_state` persistence with local JSON fallback.
- Build verification with `npm.cmd run build`.

## Still Needed Before Public Launch

1. Deploy the Next.js app to a real host.
2. Add production environment variables on the host.
3. Update Discord OAuth redirect URL to the deployed domain.
4. Run the Supabase schema and migration files.
5. Add the Roblox minutes tracker script to Roblox Studio.
6. Enable HTTP requests in the Roblox experience.
7. Test role access with real Discord accounts from each team.
8. Test one Roblox account below staff rank to confirm it gets no assignments.
9. Test one Corporate + HRD or PRD account to confirm both Corporate and Department access.
10. Decide final training and shift slot times inside the Hub.

## Recommended Final Tests

- Customer: can log in only if allowed by Discord, but should not receive staff assignments.
- World's Kitchen Team: sees only allowed resources, no Staff Activity tab.
- Supervision: can view published logs, cannot create/edit/delete logs.
- Management: can create logs, can only edit/delete their own logs unless granted admin permissions.
- Corporate: can lookup lower roles, can delete logs only when allowed by role/permission rules.
- Leadership: can manage resources, announcements, logs, assignments, and view audit logs.
- Owner: can manage admin levels, grants, categories, links, and permanent deletion.

## Current Local Note

If local `next dev` shows a SWC warning, production build can still pass after clearing `.next`. The deployment host should install fresh dependencies, so this local Windows/OneDrive binary warning should not carry into production.
