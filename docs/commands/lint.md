# `spec0 lint`

> Auto-generated from the `spec0 commands --output=json` manifest. Do not edit by hand.
> Run `npm run docs` to regenerate after changing command flags.

Lint OpenAPI spec with Spectral

## Usage

```bash
spec0 lint [spec-file] [options]
```

## Arguments

| name | required | description |
| --- | --- | --- |
| `spec-file` | no | Path to OpenAPI spec (or use --spec-file / global --spec-file) |

## Flags

| flag | description | default |
| --- | --- | --- |
| `--spec-file <path>` | Path to OpenAPI spec file |  |
| `--ruleset <file>` | Use custom ruleset file |  |
| `--org-ruleset` | Fetch org ruleset from server |  |
| `--save-ruleset <file>` | Upload <file> as the org's stored Spectral ruleset (skips the lint step) |  |
| `--format <fmt>` | Output: text, json, github, sarif | `text` |
| `--min-score <n>` | Exit 1 if score below n (0-100) | `0` |
| `--strict` | Exit 1 on any warning |  |

## Exit codes

See the [full exit-code table](../../README.md#exit-codes).

## See also

- [All commands](README.md)
- [Agent guide](../guides/ai-agents.md)
