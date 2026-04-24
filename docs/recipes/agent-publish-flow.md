# Recipe — let an agent publish on your behalf

Goal: a safe, idempotent flow an AI agent can execute end-to-end when the user says "publish this spec".

## Preconditions

- `SPEC0_TOKEN` and `SPEC0_ORG_ID` are set.
- The working directory contains an OpenAPI file.

Verify:

```bash
spec0 doctor --output=json | jq -e '.ok'
```

If `.ok` is `false`, stop and ask the user to fix their auth. Don't guess.

## Steps

```bash
# 1. Make sure the spec is well-formed enough to publish.
spec0 lint openapi.yaml --min-score 80 --format json || {
  echo "Lint below threshold. Surface the errors to the user." >&2
  exit 7
}

# 2. If the API already exists, skip the publish when the spec is unchanged.
API_NAME=$(yq '.info.title' openapi.yaml | tr '[:upper:] ' '[:lower:]-')

if spec0 api show "$API_NAME" --output=json >/dev/null 2>&1; then
  if ! spec0 sync-status "$API_NAME" --output=json | jq -e '.needsPublish' >/dev/null; then
    echo "No change since last publish — nothing to do."
    exit 0
  fi
fi

# 3. Publish with auto-computed semver so breaking changes get a major bump.
spec0 publish openapi.yaml --semver --output=json > publish-result.json

# 4. Close the loop: confirm the new version landed.
VERSION=$(jq -r .version publish-result.json)
spec0 log "$API_NAME" --output=json \
  | jq -e --arg v "$VERSION" '.[0].version == $v' >/dev/null
```

## Error handling

| Exit | What the agent should do                                                 |
| ---- | ------------------------------------------------------------------------ |
| `3`  | Ask the user for credentials or run `spec0 auth login` (interactive).    |
| `6`  | Name clash. Ask: "Update the existing API, or pick a new name?"          |
| `7`  | Lint failed. Paste the stderr into the chat and offer to fix the issues. |
| `8`  | Back off 30 s and retry once.                                            |

Everything else: relay to the user. Never silently retry a mutation twice in a row.

## Why this is safe

- `spec0 sync-status` makes the flow idempotent — re-running after a no-op publish is free.
- `spec0 publish --semver` never overwrites a released version; it always emits a new tag.
- `spec0 log` after publish verifies the result before the agent claims success.
