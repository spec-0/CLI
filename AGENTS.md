# Agent notes — Winspect CLI

This repository is the **Node.js** CLI (`@winspect/cli`). There is also a legacy **Go** `winspect resolve` binary in the same repo; do not confuse the two.

## Environment

- **Node:** `>=20` (see `package.json` `engines`).
- **Install deps:** `npm ci` (CI) or `npm install` (local).

## Verify changes

```bash
npm run build
node dist/index.js --help
node dist/index.js version
node dist/index.js version --json
```

Or `npm run cli -- <args>` (runs `node dist/index.js`).

**Tests:** `npm test` runs `pretest` (which runs `npm run build`) then Jest with `NODE_OPTIONS=--experimental-vm-modules`. Do not assume a global `winspect` install matches the working tree.

## Multi-branch / multi-worktree

- Prefer **`node /absolute/path/to/checkout/dist/index.js`** so each branch or git worktree uses its own build.
- Optionally set **`WINSPECT_CLI_GIT_REF`** (e.g. `$(git rev-parse --abbrev-ref HEAD)`) when comparing `winspect version` output across checkouts.
- **`npm link`** only maps one checkout to the global `winspect` name; it is a poor fit for comparing two branches.

## Platform URLs

- **`PLATFORM_APP_URL`** — Web app: **browser auth** (`winspect auth login` → `/cli-auth`) and **register output links** to the dashboard (`specUrl`). Not used for REST calls.
- **`PLATFORM_API_URL`** — Spring backend: **every** programmatic HTTP call (register, pull, mocks, lint, search, …). Stored as `org.apiUrl` on login.

Defaults in `src/lib/platform-defaults.ts`. **`PLATFORM_API_URL` in the environment overrides** stored `apiUrl` for all commands (see `src/lib/auth-context.ts`). Re-login to persist a new API base in `~/.winspect/config.json`.

## API clients

Implementation lives under `src/` (Commander commands, `src/lib/*`). Follow existing patterns when adding HTTP calls or config.

## Product OS

Feature and backlog tracking for Winspect lives in **api-govern-os**; sync substantive product or CLI surface changes there when applicable.
