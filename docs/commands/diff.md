# `spec0 diff`

> Auto-generated from the `spec0 commands --output=json` manifest. Do not edit by hand.
> Run `npm run docs` to regenerate after changing command flags.

Diff two specs: each side is a file path or registry ref org/api[@tag] (latest if tag omitted)

## Usage

```bash
spec0 diff <a> <b> [options]
```

## Arguments

| name | required | description |
| --- | --- | --- |
| `a` | yes | Left: local path or org/api[@tag] |
| `b` | yes | Right: local path or org/api[@tag] |

## Flags

| flag | description | default |
| --- | --- | --- |
| `--breaking-only` | Show breaking changes only (via backend oasdiff service) |  |
| `--org <uuid>` | Org id override for registry fetches |  |

## Exit codes

See the [full exit-code table](../../README.md#exit-codes).

## See also

- [All commands](README.md)
- [Agent guide](../guides/ai-agents.md)
