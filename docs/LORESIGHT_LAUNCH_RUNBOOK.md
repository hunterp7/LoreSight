# LoreSight launch runbook

This is the release checklist for the two public surfaces:

- `/widget` is the ChatGPT MCP Apps player resource.
- `/desk` is the standalone browser experience. It shares the player and
  interpreter, but owns the desk scene and browser-window controls.

## Local release gate

Use Node 20+ and pnpm 11.19.0. The repository uses `pnpm-lock.yaml` as the
authoritative lockfile; do not generate a second dependency graph with npm.

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm run check:launch
pnpm run check:submission
pnpm test
```

With the server running, also run:

```bash
pnpm run smoke
pnpm run check:submission:live
```

## Preview the public surfaces

```bash
pnpm run dev
```

- [http://localhost:8787/widget](http://localhost:8787/widget)
- [http://localhost:8787/desk](http://localhost:8787/desk)
- [http://localhost:8787/demo](http://localhost:8787/demo)

The ChatGPT widget resource is versioned independently from the app package.
Local development uses `ui://widget/storyframe-player-v5.html`. For a hosted
rollout, set `LORESIGHT_WIDGET_VERSION` to a new value such as `6` before the
build. MCP tool descriptors will then advertise the new resource URI, allowing
ChatGPT to cache the new widget separately from the previous release.

`/admin` is a private operations surface. In production it returns `404`
unless `STORYFRAME_ADMIN_PASSWORD` or `STORYFRAME_ADMIN_TOKEN` is explicitly
configured. Never add admin credentials to the widget or public browser page.

## Chrome acceptance pass

Run the widget and desk page at 393, 475, 500, 768, 820, 900, 1024, 1280,
and 1440 CSS pixels. At each width verify:

1. The CRT preserves its aspect ratio and remains centered.
2. The desk CRT remains grounded on the tabletop.
3. The browser menu is in the viewport's top-right corner.
4. The display-mode control is in the viewport's bottom-right corner.
5. No menu tile, text line, or physical button is clipped or overlaps.
6. Keyboard focus is visible and every action is reachable without a pointer.
7. Reduced motion and 200% zoom keep all actions available.

## ChatGPT Developer Mode pass

Expose only the MCP surface through the safe proxy and HTTPS tunnel:

```bash
pnpm run chatgpt:proxy
pnpm run chatgpt:tunnel
```

Connect the printed HTTPS `/mcp` URL in ChatGPT Developer Mode, then verify
opening LoreSight, browsing the library, playing the sample, loading a local
Z-machine file, changing theme, entering fullscreen, returning inline, and
continuing the same session. Refresh the app after tool/resource metadata
changes.

## Hosted release gates

Before production traffic, the deployment owner must configure stable HTTPS,
OAuth/OIDC with PKCE and the correct resource audience, managed Postgres,
secret storage, backups, migrations, rate limiting, logs, metrics, and a
rollback target. Do not submit the ChatGPT app until `check:submission:live`,
the hosted Developer Mode pass, privacy/support URLs, final screenshots, and
domain/organization verification all pass.
