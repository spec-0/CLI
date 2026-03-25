# Winspect CLI

Public CLI for the Winspect API registry — register API specs, create mock servers, lint, and interact with the Winspect SaaS.

## Install

```bash
npm install -g @winspect/cli
```

## Commands

### Authentication

- `winspect auth login` — Browser-based login, stores API key; optional `--app-url` / `--api-url` (else `PLATFORM_APP_URL` / `PLATFORM_API_URL`)
- `winspect auth logout` — Clear local config
- `winspect auth status` — Print current org and key
- `winspect auth token` — Print token (for scripting)
- `winspect auth switch <org>` — Switch default org

### Register & Init

- `winspect init` — Detect spec, create `.winspect.yaml` (add `--publish` to run `winspect register` after init)
- `winspect register` — Upload or update an OpenAPI spec on the platform (lint gate + version row). Pass the spec path as **`--spec-file <path>`**, **`winspect --spec-file <path> register`**, or a positional **`[spec-file]`** (same resolution order).
- `winspect publish` — Reserved for a future workflow; **not implemented**. Use **`register`** to sync specs today.

**Spec path resolution** (register and lint): `register --spec-file` / `lint --spec-file` wins over global `winspect --spec-file`, which wins over the optional positional `[spec-file]`. If multiple are given, they must refer to the same file.

```bash
winspect register --spec-file ./openapi.yaml --name my-api --team my-team --version 1.0.0
winspect --spec-file /abs/path/openapi.yaml register --name my-api --team my-team --version 1.0.0
winspect register ./openapi.yaml --name my-api --team my-team --version 1.0.0
```

### Mock Servers

- `winspect mock create` — Create mock server
- `winspect mock list` — List mock servers
- `winspect mock url <api-name>` — Print mock URL
- `winspect mock delete <api-name>` — Delete mock server

### Lint

- `winspect lint [spec-file]` — Lint with Spectral; same `--spec-file` / global `--spec-file` / positional rules as register; `--org-ruleset` loads org YAML from the platform

### Registry & Search

- `winspect pull <org>/<name>[@tag]` — Download spec (YAML) from registry; `-o file.yaml` to write
- `winspect search <query>` — Semantic search in your org (`--max-results`)
- `winspect log <api-ref>` — Version history (`org/api` or `api-name` with default org slug from config); `--json`
- `winspect diff <a> <b>` — Unified diff: each side is a **file path** or **registry ref** `org/api[@tag]`; `--breaking-only` uses [`oasdiff`](https://github.com/Tufin/oasdiff) if installed
- `winspect status` — Org summary (API count, mocks, teams, plan) + mock table; `--json`

### Other

- `winspect version` — Print package version and Node.js version; optional `WINSPECT_CLI_GIT_REF` line when set (see [Local development](#local-development--testing-multiple-branches))
- `winspect version --json` — Same fields as JSON (for scripts)
- `winspect -V` / `winspect --version` — Short version string (from `package.json`)
- `winspect team` — Team management
- `winspect mcp url` — Print MCP server URL for Cursor/Claude

## Distribution

- **npm:** `npm install -g @winspect/cli` (primary).
- **GitHub Action:** [publish-api-spec-action](https://github.com/winspect-labs/publish-api-spec-action) — update workflows to use `npx @winspect/cli register` (the `publish` subcommand is a placeholder until implemented).
- **Homebrew / single binary / curl installer:** planned for a later release (track `cli-distribution` in api-govern-os).

## CI Usage

Set environment variables for non-interactive use:

```bash
export PLATFORM_API_TOKEN=org_xxx
export PLATFORM_ORG_ID=uuid
winspect register
```

**Two different origins:**

| Variable | Used for | Default (if unset) |
|----------|----------|---------------------|
| **`PLATFORM_APP_URL`** | **Auth only** (browser): base URL for `winspect auth login` → `/cli-auth`. Also used for **optional dashboard links** printed by `winspect register` (`specUrl` — opens the API in the UI; not an HTTP call to the backend). | `http://localhost:3000` |
| **`PLATFORM_API_URL`** | **All backend traffic**: register, pull, mock, lint, search, registry, and any other CLI HTTP to Spring. Stored in config on login as the API base. | `http://localhost:8080/api-management` |

Do **not** point `PLATFORM_API_URL` at the Next.js dev server (`:3000`) — e.g. `POST …/discovery/spec-records/sync` must go to the **API**. Match **`NEXT_PUBLIC_API_BASE_URL`** from `api-management-ui` (often includes `/api-management` when Spring uses that servlet context path).

Staging / production: set both, for example:

```bash
export PLATFORM_APP_URL=https://winspect-app-staging.up.railway.app
export PLATFORM_API_URL=https://your-backend-host.example.com/api-management
```

Set **`PLATFORM_API_URL` in your environment** when you run any command (e.g. `export` in the shell, or a `.env` loaded by your tool). **If set, it overrides** the API base stored at login, so you can run `winspect register` from any directory without re-login after fixing a bad stored URL. To persist a new API base in config, run **`winspect auth login`** again (or use `winspect auth login --api-url …`).

## Version

The published semver comes from `package.json`. Examples:

```bash
winspect --version
winspect version
WINSPECT_CLI_GIT_REF=$(git rev-parse --abbrev-ref HEAD) winspect version
winspect version --json
```

## Local development & testing multiple branches

Use **Node 20+**. With defaults, the CLI assumes Next on **:3000** and the API on **:8080** (see table above). Override with `PLATFORM_APP_URL` / `PLATFORM_API_URL` as needed.

From the CLI repo:

```bash
npm ci
npm run build
node dist/index.js version
# or:
npm run cli -- version
```

**Several branches or worktrees at once:** `npm link` only points the global `winspect` binary at one checkout. To run different branches side by side, call the built entrypoint with an **absolute path** (each clone/worktree has its own `dist/`):

```bash
node /path/to/winspect-cli-main/dist/index.js version
node /path/to/winspect-cli-feature/dist/index.js version
```

Optional: tag output so you know which tree you ran:

```bash
WINSPECT_CLI_GIT_REF=$(git -C /path/to/winspect-cli-feature rev-parse --abbrev-ref HEAD) \
  node /path/to/winspect-cli-feature/dist/index.js version
```

**Shell aliases (zsh/bash):**

```bash
alias winspect-main='node ~/src/winspect-cli/dist/index.js'
alias winspect-feature='node ~/src/winspect-cli-feature/dist/index.js'
```

**Git worktrees:** `git worktree add ../winspect-cli-other main` — build in each directory independently.

**API / org:** Point commands at the right backend using the same env vars as CI (`PLATFORM_API_TOKEN`, `PLATFORM_ORG_ID`) and org config from `winspect auth login` per machine.

**Agents / automation:** Prefer `node <repo>/dist/index.js` (or `npm run cli --` after `npm run build`) so the binary always matches the checked-out commit. See `AGENTS.md` in this repo.

## Build & test

```bash
npm install
npm run build
node dist/index.js --help
npm test   # runs `pretest` (build) then Jest
```

## Go Resolve Command (Legacy)

The repo also contains a Go-based `winspect resolve` command for resolving tokens in ApiSpec manifests. Build with:

```bash
go build -o winspect .
```
