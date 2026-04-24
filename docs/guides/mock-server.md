# Mock server lifecycle

Every published API gets a hosted mock. The CLI lets you provision, inspect, and consume it from CI.

## Create (or fetch existing)

```bash
spec0 mock create --api my-api
```

Output:

```
Mock server created:
  Mock URL:  https://api.spec0.io/mock/abc123
  API Key:   sk_live_... (shown once — copy and keep safe)
```

The backend is idempotent: running `create` again against the same API returns the same mock **without** re-issuing the key. Capture the key on the first run:

```bash
spec0 mock create --api my-api --output=json | jq -r '.apiKey' > .mock-key
```

## List

```bash
spec0 mock list
spec0 mock list --output=json | jq '.[].mockUrl'
```

## Show (single mock)

```bash
spec0 mock show my-api
```

```
mock for my-api

  name:          default
  api id:        5f09...
  mock server:   d3ac...
  mock url:      https://api.spec0.io/mock/abc123
```

## Pipe-friendly URL

```bash
export MOCK=$(spec0 mock url my-api)
curl -s "$MOCK/health"
```

## Probe operations

```bash
# Happy path
curl -s -H "X-API-Key: $(cat .mock-key)" "$MOCK/orders" | jq

# Fault injection — force a 500 for the next request
curl -s -H "X-API-Key: $(cat .mock-key)" \
     -H "X-Mock-Force-Status: 500" \
     "$MOCK/orders"
```

## Deleting / refreshing

`spec0 mock delete` and `spec0 mock refresh` are on the roadmap but **blocked on backend endpoints** — see [`ROADMAP.md`](../../ROADMAP.md) for status.

Today, after a spec change just call `spec0 push` (or `spec0 publish`) — the hosted mock serves the latest published version automatically.
