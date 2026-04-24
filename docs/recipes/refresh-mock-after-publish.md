# Recipe — mock always matches the latest spec

Goal: after `spec0 publish`, have consumers hit a mock that reflects the spec you just pushed.

## The good news

The platform's hosted mock server **already** serves the latest published version of the spec for any API. Once `spec0 mock create --api my-api` has run once, the URL stays stable and the response shape tracks the spec.

## What you should verify in CI

```yaml
- name: Publish
  run: spec0 publish openapi.yaml --semver
  env:
    SPEC0_TOKEN: ${{ secrets.SPEC0_TOKEN }}
    SPEC0_ORG_ID: ${{ secrets.SPEC0_ORG_ID }}

- name: Resolve mock URL
  id: mock
  run: echo "url=$(spec0 mock url my-api)" >> "$GITHUB_OUTPUT"

- name: Smoke test the mock
  run: |
    curl -sSf "${{ steps.mock.outputs.url }}/health" | jq .
```

## First-time mocks

If the API has never had a mock, `spec0 mock url` exits `5` (NOT_FOUND). Seed once with:

```bash
spec0 mock create --api my-api --output=json \
  | jq -r '.apiKey' > .mock-key   # capture the one-time key
```

The key only appears on first creation — save it.

## Agent workflow

```bash
if ! spec0 mock show my-api --output=json >/dev/null 2>&1; then
  spec0 mock create --api my-api --output=json
fi
spec0 mock url my-api
```
