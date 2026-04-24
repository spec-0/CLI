# Spec0 CLI

Public CLI for the Spec0 API registry — register API specs, create mock servers, lint, and interact with the Spec0 SaaS.

## Install

Requires **Node.js 20+**.

```bash
npm install -g @spec0/cli
```

## Commands

### Authentication

- `spec0 auth login` — Browser-based login, stores API key; optional `--app-url` / `--api-url` (else `PLATFORM_APP_URL` / `PLATFORM_API_URL`)
- `spec0 auth logout` — Clear local config
- `spec0 auth status` — Print current org and key
- `spec0 auth token` — Print token (for scripting)
- `spec0 auth switch <org>` — Switch default org

### Register & Init

- `spec0 init` — Detect spec, create `.spec0.yaml` (add `--publish` to run `spec0 register` after init)
- `spec0 register` — Upload or update an OpenAPI spec on the platform (lint gate + version row). Pass the spec path as **`--spec-file <path>`**, **`spec0 --spec-file <path> register`**, or a positional **`[spec-file]`** (same resolution order).
- `spec0 publish` — Reserved for a future workflow; **not implemented**. Use **`register`** to sync specs today.

**Spec path resolution** (register and lint): `register --spec-file` / `lint --spec-file` wins over global `spec0 --spec-file`, which wins over the optional positional `[spec-file]`. If multiple are given, they must refer to the same file.

```bash
spec0 register --spec-file ./openapi.yaml --name my-api --team my-team --version 1.0.0
spec0 --spec-file /abs/path/openapi.yaml register --name my-api --team my-team --version 1.0.0
spec0 register ./openapi.yaml --name my-api --team my-team --version 1.0.0
```

### Mock Servers

- `spec0 mock create` — Create mock server
- `spec0 mock list` — List mock servers
- `spec0 mock url <api-name>` — Print mock URL
- `spec0 mock delete <api-name>` — Delete mock server

### Lint

- `spec0 lint [spec-file]` — Lint with Spectral; same `--spec-file` / global `--spec-file` / positional rules as register; `--org-ruleset` loads org YAML from the platform

### Registry & Search

- `spec0 pull <org>/<name>[@tag]` — Download spec (YAML) from registry; `-o file.yaml` to write
- `spec0 search <query>` — Semantic search in your org (`--max-results`)
- `spec0 log <api-ref>` — Version history (`org/api` or `api-name` with default org slug from config); `--json`
- `spec0 diff <a> <b>` — Unified diff: each side is a **file path** or **registry ref** `org/api[@tag]`; `--breaking-only` uses [`oasdiff`](https://github.com/Tufin/oasdiff) if installed
- `spec0 status` — Org summary (API count, mocks, teams, plan) + mock table; `--json`

### Other

- `spec0 version` — Print package version and Node.js version; `--json` for machine-readable output
- `spec0 -V` / `spec0 --version` — Short version string (from `package.json`)
- `spec0 team` — Team management
- `spec0 mcp url` — Print MCP server URL for Cursor/Claude

## Distribution

- **npm:** `npm install -g @spec0/cli` (primary).
- **GitHub Action:** [publish-api-spec-action](https://github.com/winspect-labs/publish-api-spec-action) — use `npx @spec0/cli register` in workflows (the `publish` subcommand is not implemented yet).
- **Homebrew / single binary / curl installer:** planned for a later release.

## CI Usage

Set environment variables for non-interactive use:

```bash
export PLATFORM_API_TOKEN=org_xxx
export PLATFORM_ORG_ID=uuid
spec0 register
```

**Two different origins:**

| Variable               | Used for                                                                                                                                                                                                               | Default (if unset)                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **`PLATFORM_APP_URL`** | **Auth only** (browser): base URL for `spec0 auth login` → `/cli-auth`. Also used for **optional dashboard links** printed by `spec0 register` (`specUrl` — opens the API in the UI; not an HTTP call to the backend). | `http://localhost:3000`                |
| **`PLATFORM_API_URL`** | **All backend traffic**: register, pull, mock, lint, search, registry, and any other CLI HTTP to Spring. Stored in config on login as the API base.                                                                    | `http://localhost:8080/api-management` |

Do **not** point `PLATFORM_API_URL` at the Next.js dev server (`:3000`) — e.g. `POST …/discovery/spec-records/sync` must go to the **API**. Match **`NEXT_PUBLIC_API_BASE_URL`** from `api-management-ui` (often includes `/api-management` when Spring uses that servlet context path).

Staging / production: set both, for example:

```bash
export PLATFORM_APP_URL=https://spec0-app-staging.up.railway.app
export PLATFORM_API_URL=https://your-backend-host.example.com/api-management
```

Set **`PLATFORM_API_URL` in your environment** when you run any command (e.g. `export` in the shell, or a `.env` loaded by your tool). **If set, it overrides** the API base stored at login, so you can run `spec0 register` from any directory without re-login after fixing a bad stored URL. To persist a new API base in config, run **`spec0 auth login`** again (or use `spec0 auth login --api-url …`).

## Version

The published semver comes from `package.json`. Examples:

```bash
spec0 --version
spec0 version
spec0 version --json
```

## Contributing

Clone this repository and see **`AGENTS.md`** for build commands, tests, and local development.
