# Recipe — block merges on breaking changes

Goal: fail the PR if the proposed spec change breaks the last published contract.

## One-shot command

```bash
spec0 diff openapi.yaml acme/orders --breaking-only
```

Exit `0` when no breaking changes found; non-zero when there are. Wire straight into a CI step.

## Full GitHub Actions job

```yaml
- name: Check for breaking changes
  run: spec0 diff openapi.yaml acme/orders --breaking-only
  env:
    SPEC0_TOKEN: ${{ secrets.SPEC0_TOKEN }}
    SPEC0_ORG_ID: ${{ secrets.SPEC0_ORG_ID }}
```

## Or let the platform decide semver

`spec0 publish openapi.yaml --semver` asks the backend to classify the diff (PATCH / NON_BREAKING / BREAKING) and auto-compute the next version tag. Breaking changes get a major bump — no PR block needed; consumers can pin.

## Agent workflow

```bash
spec0 api changelog acme/orders --from v1.2.0 --to HEAD --output=json \
  | jq '.breakingChanges | length'
```

If `> 0`, surface them to the user before proceeding.
