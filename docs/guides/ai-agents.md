# For AI agents

The `spec0` CLI is designed so agents can use it without hardcoded knowledge. This guide describes how.

## The contract

Three things you can rely on forever:

1. **Every command has a stable name, stable flags, and a stable exit code.** Deprecations go through a one-minor warning window. Breaking changes bump the CLI major version.
2. **`--output=json` is available on every structured command.** Progress goes to stderr, the final result is exactly one JSON document on stdout.
3. **Exit codes are categorical.** `0` success; `2` usage; `3` auth; `4` permission; `5` not found; `6` conflict; `7` validation; `8` rate limit; `9` server; `10` network. See `spec0 commands --output=json` for the current table.

You don't need to remember the command list. Ask the binary.

## Step 1 — discover capabilities

```bash
spec0 commands --output=json
```

Returns a capability manifest:

```json
{
  "version": "0.1.0",
  "commands": [
    {
      "name": "publish",
      "description": "Publish an API spec to the public registry (org-scoped, shareable URL, no team required)",
      "usage": "spec0 publish [spec-file] [options]",
      "args": [{ "name": "spec-file", "required": false }],
      "flags": [
        { "flags": "--name <slug>", "description": "URL-safe API slug ..." },
        { "flags": "--semver", "description": "Auto-compute next version ..." }
      ]
    }
  ],
  "exitCodes": {
    "0": "success",
    "3": "not authenticated",
    ...
  }
}
```

Re-read this manifest at the start of each session. It's always in lockstep with the binary — no version drift.

Narrow the result with a pattern:

```bash
spec0 commands mock --output=json        # only mock commands
spec0 commands api --output=json         # only API management commands
```

## Step 2 — map task to command

The command surface groups semantically:

| If the user wants to…             | Use                                          |
| --------------------------------- | -------------------------------------------- |
| authenticate                      | `spec0 auth login` (interactive) or env vars |
| confirm auth is wired             | `spec0 doctor` or `spec0 whoami`             |
| push a spec privately             | `spec0 push <file> --team <team>`            |
| publish a spec to the registry    | `spec0 publish <file> --semver`              |
| check if publish would be a no-op | `spec0 sync-status <api>`                    |
| list APIs in the org              | `spec0 api list`                             |
| inspect one API                   | `spec0 api show <ref>`                       |
| diff published versions           | `spec0 api changelog <ref>`                  |
| diff local vs published           | `spec0 diff <file> <org>/<api>`              |
| download a published spec         | `spec0 pull <org>/<api>[@tag]`               |
| find APIs by description          | `spec0 search "<query>"`                     |
| lint a local spec                 | `spec0 lint <file> --min-score N`            |
| upload a shared ruleset           | `spec0 lint --save-ruleset <file>`           |
| spin up a mock                    | `spec0 mock create --api <name>`             |
| locate a mock's URL               | `spec0 mock url <api>` (one line)            |
| generate a CI workflow            | `spec0 ci generate github`                   |

When unsure, fall back to `spec0 commands <keyword>` and read the descriptions.

## Step 3 — invoke

Always pass `--output=json` (or `yaml`) when parsing the result. Example:

```bash
spec0 api list --output=json | jq '.[] | select(.status == "ACTIVE")'
spec0 mock list --output=json | jq -r '.[].mockUrl'
spec0 sync-status my-api --output=json | jq -r '.needsPublish'
```

Pass credentials via env, never on the command line:

```bash
SPEC0_TOKEN=... SPEC0_ORG_ID=... spec0 publish openapi.yaml --semver --output=json
```

## Step 4 — react to exit codes

Branch on the exit code, not on stderr substring matching:

| Exit | Agent action                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| `0`  | Success. Parse stdout for the structured result.                                                                    |
| `2`  | You sent bad flags. Re-read the manifest for this command.                                                          |
| `3`  | Auth missing. Ask the user for `SPEC0_TOKEN` + `SPEC0_ORG_ID`, or run `spec0 auth login`.                           |
| `4`  | User is authenticated but lacks permission. Ask them to switch org or request access.                               |
| `5`  | Resource doesn't exist. Offer to create it (`publish` / `mock create`) or suggest `spec0 api list` to disambiguate. |
| `6`  | Name clash. Suggest a different name or pass `--api-id` to target the existing one.                                 |
| `7`  | Validation failed — usually a spec quality issue. Surface the stderr; consider `spec0 lint <file>` for details.     |
| `8`  | Rate limited. Back off (exponential, 30 s+) and retry.                                                              |
| `9`  | Platform server error. One retry is fine; two is noise.                                                             |
| `10` | Network unreachable. Retry with backoff; if persistent, the platform is probably down.                              |

## Step 5 — close the loop

After a mutation, verify:

- After `publish`, call `spec0 log <ref>` to confirm the version landed.
- After `mock create`, call `spec0 mock show <api>` for the URL + provisioning state.
- After `push`, call `spec0 api show <ref>` to confirm metadata.

This is cheap (one GET) and avoids declaring success on a failed mutation.

## Semantic search via MCP

The Spec0 platform exposes an MCP server for semantic search over the org's APIs — useful when the user's request is fuzzy ("find the API that handles refunds") rather than exact. Get the URL with:

```bash
spec0 mcp url
```

Wire the URL into your MCP client config. The CLI itself does not need to proxy these calls.

## What the CLI **won't** do for you

- **It won't pick an API name.** If the user says "publish my spec", read `info.title` from the spec or ask.
- **It won't break without warning.** Deprecated flags print a one-minor warning on stderr — read those and update.
- **It won't hide errors under `0`.** Any non-zero exit means you should not assume success.
- **It won't guess credentials.** Missing env → `3`, every time.

## When things go wrong

Start with `spec0 doctor`. It reports the resolved source for every setting (env var name, config path, or default). Ninety-percent of "authed but not working" cases are a wrong URL or stale token visible there in two seconds.

If a command fails with an exit code the table above doesn't cover (e.g. `1`), it's an unclassified failure — treat it like `9` (maybe-transient, one retry allowed), and escalate to the human if the retry fails.
