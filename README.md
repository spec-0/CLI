# @spec0/cli

The scriptable control plane for the [Spec0](https://spec0.io) platform. Register APIs, run mocks, lint, publish, and gate releases — from your terminal or CI.

```bash
npm install -g @spec0/cli
spec0 --version
```

Requires **Node.js 20+**.

## 60-second quickstart

```bash
# 1. authenticate (browser flow)
spec0 auth login

# 2. from a repo containing an OpenAPI file
spec0 init                               # writes .spec0.yaml
spec0 lint openapi.yaml --min-score 80   # optional: gate on quality
spec0 push openapi.yaml                  # team-scoped
spec0 publish openapi.yaml --semver      # public registry, auto-bumped

# 3. spin up a mock server
spec0 mock create --api my-api
spec0 mock show my-api                   # URL + metadata
```

Or non-interactively in CI:

```bash
export SPEC0_TOKEN=...
export SPEC0_ORG_ID=...
spec0 publish openapi.yaml --semver
```

## Commands

### Auth & diagnostics

| Command             | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `spec0 auth login`  | Browser-based login; stores API key locally.                            |
| `spec0 auth logout` | Clear the locally stored token.                                         |
| `spec0 auth status` | Print the active org + key metadata.                                    |
| `spec0 auth switch` | Switch the default org (multi-tenant setups).                           |
| `spec0 whoami`      | One-line org + user summary.                                            |
| `spec0 doctor`      | Print which source each setting resolved from (env / config / default). |

### Spec lifecycle

| Command              | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `spec0 init`         | Detect `openapi.yaml` in cwd, write `.spec0.yaml`.                      |
| `spec0 push`         | Upload spec to the team-scoped workspace (private).                     |
| `spec0 publish`      | Publish to the public registry; `--semver` auto-bumps based on oasdiff. |
| `spec0 lint`         | Spectral lint; `--org-ruleset`, `--save-ruleset <file>`, `--min-score`. |
| `spec0 pull <ref>`   | Download a published spec (`acme/orders@v1.2.0`).                       |
| `spec0 diff <a> <b>` | Diff specs; both sides can be file paths or registry refs.              |
| `spec0 log <ref>`    | Version history for a published API.                                    |
| `spec0 search`       | Semantic search across the org's APIs.                                  |

### API management

| Command                     | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `spec0 api list`            | Catalogue view with `--team / --status / --search` filters.        |
| `spec0 api show <ref>`      | Single-API summary (counts, team, status).                         |
| `spec0 api changelog <ref>` | Diff between published versions; `--from / --to`, markdown output. |

### Mock servers

| Command                 | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `spec0 mock create`     | Provision (or fetch) the default mock; prints one-time key. |
| `spec0 mock list`       | Table of every mock in the org.                             |
| `spec0 mock show <api>` | Structured view (URL + metadata) for one mock.              |
| `spec0 mock url <api>`  | Pipe-friendly single-line URL (for `$(…)` substitution).    |

### CI helpers

| Command                    | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `spec0 sync-status <ref>`  | Has the spec changed since last publish? Auto-detects git SHA. |
| `spec0 ci generate github` | Emit a ready-to-commit `.github/workflows/spec0-publish.yml`.  |
| `spec0 status`             | Org overview: API count, mocks, teams, plan.                   |

### Other

- `spec0 version` — CLI + Node version (text or `--output=json`).
- `spec0 mcp url` — Print the MCP server URL for Cursor / Claude.

Every command supports `--output=text|json|yaml` unless noted; progress goes to stderr, data to stdout.

## Authentication

Two equivalent paths:

1. **Interactive**: `spec0 auth login` writes `~/.config/spec0/config.json`.
2. **Non-interactive**: set `SPEC0_TOKEN` and `SPEC0_ORG_ID`.

| Variable        | Purpose                                                      | Default                      |
| --------------- | ------------------------------------------------------------ | ---------------------------- |
| `SPEC0_TOKEN`   | Bearer token sent on every request.                          | _required_ for non-auth cmds |
| `SPEC0_ORG_ID`  | UUID of the org the CLI acts against.                        | _required_                   |
| `SPEC0_API_URL` | Platform backend base URL.                                   | `https://api.spec0.io`       |
| `SPEC0_APP_URL` | Platform web app (used for auth callback + dashboard links). | `https://spec0.io`           |

`PLATFORM_*` variants are accepted for one-minor backwards compatibility and will be removed in the next major. Use `spec0 doctor` to see which source each value is resolving from.

## Exit codes

Stable forever — CI pipelines depend on them.

| Code | Meaning                                             |
| ---- | --------------------------------------------------- |
| 0    | success                                             |
| 1    | generic / unclassified failure                      |
| 2    | usage error (bad flags, missing args)               |
| 3    | not authenticated (no token / token expired)        |
| 4    | permission denied (403)                             |
| 5    | resource not found (404)                            |
| 6    | conflict (409 — e.g. name already taken)            |
| 7    | validation failed (422 — e.g. spec below min score) |
| 8    | rate limited (429)                                  |
| 9    | upstream server error (5xx)                         |
| 10   | network error (unreachable, timeout)                |

## CI pattern

The recommended GitHub Actions workflow — auto-generated by `spec0 ci generate github` — only publishes when the spec has changed:

```yaml
- name: skip if unchanged
  id: sync
  run: |
    if spec0 sync-status my-api --output=json | jq -e '.needsPublish | not' >/dev/null; then
      echo "skip=1" >> "$GITHUB_OUTPUT"
    fi

- name: publish
  if: steps.sync.outputs.skip != '1'
  run: spec0 publish openapi.yaml --semver
  env:
    SPEC0_TOKEN: ${{ secrets.SPEC0_TOKEN }}
    SPEC0_ORG_ID: ${{ secrets.SPEC0_ORG_ID }}
```

## Guides

- [Getting started](docs/guides/getting-started.md) — from zero to published in one terminal session.
- [GitHub Actions CI](docs/guides/ci-github-actions.md) — the workflow we recommend, copy-pasteable.
- [Mock server lifecycle](docs/guides/mock-server.md) — create / show / url / test.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Short version: typos + small fixes welcome via PR; for anything larger, open an issue first. Security reports go to [`SECURITY.md`](SECURITY.md).

## License

MIT. See [`LICENSE`](LICENSE).
