# Neon setup for LoreSight

Neon is the selected managed Postgres provider for the hosted LoreSight pilot.

## Create the database

1. Create a Neon project in the production region closest to the expected users.
2. Create separate `preview` and `production` branches or projects.
3. Copy the pooled production connection string from Neon. Keep it in Vercel's encrypted environment variables; never commit it or expose it to the widget.
4. Enable Neon point-in-time restore/retention appropriate for the pilot.

## Environment contract

Set the server-only variable below in Vercel for Preview and Production. The exact variable name may be changed if the selected Postgres driver uses a more specific name, but the public browser bundle must never receive it.

```text
STORYFRAME_DATABASE_URL=postgresql://...
```

The deployment must also receive the existing OAuth variables:

```text
STORYFRAME_OAUTH_ISSUER=https://...
STORYFRAME_OAUTH_RESOURCE=https://mcp.loresight.hunterpriester.com
STORYFRAME_OAUTH_JWKS_URI=https://...
```

## Migration gate

Run the one-shot migration job against the production branch before routing traffic. It must stop on checksum drift and must never edit an already-applied migration. Record the migration result and a restore test before enabling durable classic-session writes.

## Classic-session data boundary

The dedicated repository will persist session identifiers, owner identifiers, story/file metadata, transcript entries, theme settings, mutation receipts, and state versions. It will not persist raw local Z-machine bytes unless a future upload feature is explicitly approved.

## Vercel wiring

After linking the Vercel project, add `STORYFRAME_DATABASE_URL` in the project environment settings for Preview and Production. Pulling environment values locally should write only to an ignored `.env.local` file. Verify that no `NEXT_PUBLIC_` or client-exposed variable contains the database URL.
