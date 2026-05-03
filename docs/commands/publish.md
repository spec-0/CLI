# `spec0 publish`

> Auto-generated from the `spec0 commands --output=json` manifest. Do not edit by hand.
> Run `npm run docs` to regenerate after changing command flags.

Publish an API spec to the public registry (org-scoped, shareable URL, no team required)

## Usage

```bash
spec0 publish [spec-file] [options]
```

## Arguments

| name | required | description |
| --- | --- | --- |
| `spec-file` | no | Path to OpenAPI spec (or use --spec-file / global --spec-file) |

## Flags

| flag | description | default |
| --- | --- | --- |
| `--spec-file <path>` | Path to OpenAPI spec file |  |
| `--public-api-id <id>` | Existing public API ID to update |  |
| `--name <slug>` | URL-safe API slug (e.g. payments-api). Inferred from spec info.title if omitted. |  |
| `--title <title>` | Human-readable display title. Defaults to --name if omitted. |  |
| `--description <text>` | Short description of the API |  |
| `--version <version>` | Explicit semver tag for this version (e.g. 1.0.0) |  |
| `--bump <type>` | Server-computed bump: minor | patch. Mutually exclusive with --version. |  |
| `--visibility <state>` | Visibility: draft | published | unlisted (default: published) | `published` |
| `--release-notes <text>` | Release notes for this version |  |
| `--git-sha <sha>` | Git commit SHA for provenance |  |
| `--strict` | Fail on any Spectral lint warning |  |
| `--skip-lint` | Skip lint gate |  |
| `--dry-run` | Validate only, do not call the API |  |
| `--format <fmt>` | Output format: text | json | github | `text` |
| `--org <org>` | Override default org (UUID) |  |

## Exit codes

See the [full exit-code table](../../README.md#exit-codes).

## See also

- [All commands](README.md)
- [Agent guide](../guides/ai-agents.md)
