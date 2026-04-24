# Roadmap

Goal: every API-management operation available in the spec0 web app should be scriptable from CI through `@spec0/cli`, deterministically and non-interactively.

## Principles

- **CI-first.** Every command supports `--output=json|table|csv`, respects `SPEC0_TOKEN` + `SPEC0_ORG_ID` env vars, and exits with stable, documented codes.
- **One command per intent.** Verbs (`list`, `show`, `create`, `update`, `delete`) under a noun (`api`, `team`, `env`, `subscriber`).
- **Offline-buildable, dogfood-refreshed.** `openapi-spec/cli-api-spec.yaml` is vendored so `npm run build` works without network. `npm run sync:spec` refreshes it by pulling `spec0/cli-api` from the platform itself.
- **Pipe-safe stdout.** Progress on stderr; structured data on stdout under `--output=json`.

## Today

`auth` · `init` · `push` · `publish` · `mock` · `lint` · `pull` · `search` · `diff` · `log` · `status` · `mcp` · `version` · `whoami`

## Gaps — prioritised

### P0 — API management from CI (headline)

- `spec0 api list` — catalogue view, filters by team / status / search. ✅ shipped.
- `spec0 api show <ref>` — single-API summary. ✅ shipped.
- `spec0 api changelog <ref>` — diff between published versions. ✅ shipped.
- `spec0 api update <ref> [--name|--description|--status]` — partial updates. **Blocked**: backend needs a JSON `PATCH /apis/{id}` for metadata-only changes (the existing `PUT /apis/{id}` is multipart and requires a spec file).
- `spec0 api delete <ref>` — soft delete. **Blocked**: backend needs `DELETE /api-management/cli/v1/apis/{id}` exposed in the CLI surface.

### P1 — Teams, permissions, environments

- `spec0 team list|show|create`
- `spec0 team member add|remove <team> <user>`
- `spec0 api permissions list|add <ref>`
- `spec0 api env list|add|update|remove <ref>`

### P2 — Subscribers, richer mock control, quality gates

- `spec0 api subscribers list <ref>` / `spec0 subscribers pending|approve|reject`
- `spec0 mock show <api>` — structured view of a single mock server. ✅ shipped.
- `spec0 mock refresh <api>` — re-provision mock against the latest spec. **Blocked**: backend needs a `POST /mocks/{id}/refresh` (or equivalent) endpoint.
- `spec0 mock delete <api>` — remove mock server. **Blocked**: backend needs `DELETE /api-management/cli/v1/mocks/{id}` on the CLI surface.
- `spec0 mock configure <api> --strategy ...` / `mock variants add` / `mock logs --tail`
- `spec0 quality score <ref> --min-score N` — fail the pipeline below threshold

### P3 — Discovery & release helpers

- `spec0 discovery list|map|adopt`
- `spec0 release tag <ref> --version <semver>`
- `spec0 release diff <ref> <v1> <v2> --breaking-only`

## Cross-cutting

- `src/lib/output-format.ts` + global `--output` flag applied to every command.
- Documented exit codes: `0` ok, `2` usage, `3` auth missing, `4` permission denied, `5` not found, `6` conflict, `7` validation, `8` rate limited, `9` server error.
- `src/lib/ref-resolver.ts` — shared parsing of `org/api[@tag]` / UUID, with `/apis/summary` lookup.

## Non-goals

- Web UI (lives in the platform).
- Authoring OpenAPI specs (user's editor).
- Local embedded mock server runtime (the hosted mock server is the source of truth).
