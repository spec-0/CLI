# Release policy

`@spec0/cli` is released via tag-triggered automation using **npm Trusted Publishing** (OIDC). Pushing a `vX.Y.Z` tag to `main` runs `.github/workflows/release.yml`, which lints, builds, tests, then publishes to npm (with provenance, no long-lived token) and creates a GitHub release with auto-generated notes.

## Versioning

[Semantic Versioning](https://semver.org/). On the `0.x` line the CLI surface is considered unstable; breaking changes may ship in minor releases and will be called out in the release notes.

- **patch** (`0.1.0` → `0.1.1`) — bug fixes, doc-only changes, non-surface refactors.
- **minor** (`0.1.x` → `0.2.0`) — new commands or flags; additive changes; accepted breaking changes pre-1.0.
- **major** (`0.x` → `1.0.0`, later `1.x` → `2.0.0`) — removal of commands, flags, or exit codes; removal of legacy env vars (e.g. `PLATFORM_*`).

## Cutting a release

From a clean `main` that is green on CI:

```bash
# 1. Bump package.json + package-lock.json
npm version patch   # or: minor / major / X.Y.Z

# 2. Push the commit + tag
git push origin main --follow-tags
```

`npm version` creates a commit `chore: vX.Y.Z` and tag `vX.Y.Z`. The tag push triggers the release workflow.

## What the automation does

On a `v*` tag push:

1. Checks out the tag.
2. Upgrades npm CLI to the latest (trusted publishing requires `npm >= 11.5.1`).
3. Verifies `package.json` version equals the tag (`vX.Y.Z` → `X.Y.Z`); fails the release otherwise.
4. `npm ci` → `npm run lint` → `npm run build` → `npm test` → `npm run test:smoke`.
5. `npm publish --access public`. The npm CLI sees the `id-token: write` permission, mints a GitHub OIDC token, exchanges it with npm for a short-lived publish token, and publishes. Provenance attestations are generated automatically.
6. `softprops/action-gh-release` creates a GitHub release with auto-generated notes.

## Trusted publisher configuration

Configured once on npmjs.com → **@spec0/cli** → Settings → Trusted Publishers:

| Field                | Value          |
| -------------------- | -------------- |
| Publisher            | GitHub Actions |
| Organization or user | `spec-0`       |
| Repository           | `CLI`          |
| Workflow filename    | `release.yml`  |
| Environment          | _(unset)_      |

No GitHub secrets are required for publishing. The workflow's `GITHUB_TOKEN` (provided by Actions automatically) only needs `contents: write` to cut the GitHub release.

## Yanking a release

```bash
npm deprecate @spec0/cli@X.Y.Z "reason — use X.Y.(Z+1)"
```

Do not `npm unpublish` except within the 72-hour window for an accidental publish; deprecation is the standard path.

## Bootstrap history

The initial `0.1.0` publish was done manually with `npm publish --access public --otp=<code>` to create the package on the registry, since trusted publishing requires an existing package to configure. All subsequent releases go through the automated workflow.
