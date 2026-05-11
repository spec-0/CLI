# GitHub Actions: publish on change

A minimal workflow that (a) lints on every PR, (b) publishes on pushes to `main` only when the spec actually changed.

## Auto-generate

```bash
spec0 ci generate github --spec-file openapi.yaml --branch main > .github/workflows/spec0.yml
```

Or write it directly to the suggested path:

```bash
spec0 ci generate github --spec-file openapi.yaml --write
```

## Secrets

Configure two repository secrets:

- `SPEC0_TOKEN` — from `spec0 auth token`, or a machine-account token from the web app.
- `SPEC0_ORG_ID` — UUID of the org to publish into.

## What the generated workflow does

1. Installs `@spec0/cli` globally.
2. Lints on every PR — fails the check if `--min-score` is not met.
3. On `push` to `main`:
   - Runs `spec0 sync-status` to check whether the spec actually changed.
   - Skips `publish` when the git SHA matches the last published version (cheap no-op).
   - Otherwise calls `spec0 publish --semver` to publish and compute the next version.

## Troubleshooting

| Symptom                                | Check                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Exit 3 / "not authenticated"           | `SPEC0_TOKEN` / `SPEC0_ORG_ID` secrets not set, or token expired.                            |
| Exit 7 / lint below min score          | Either fix the spec, lower `--min-score`, or adjust the org ruleset.                         |
| Exit 9 / server error, or 10 / network | Transient — re-run the job. If persistent, check [status.spec0.io](https://status.spec0.io). |
| Exit 2 / usage                         | Flag typo or unknown CI provider. Run the command locally with `--help`.                     |

All exit codes are documented in the [README](../../README.md#exit-codes).
