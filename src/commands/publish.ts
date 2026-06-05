/**
 * spec0 publish — publish an OpenAPI spec to the public API registry.
 *
 * Unlike `spec0 register` (which is team-scoped and private), `publish` creates
 * org-scoped public APIs accessible via a shareable URL with no authentication.
 *
 * URL convention: {platform}/public/registry/{org-slug}/{api-slug}
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { existsSync, readFileSync } from "fs";
import {
  PublicApisService,
  type PublicPublishRequestV1,
  type Visibility,
} from "@spec0/sdk-public-platform";
import { runSpectral } from "../lib/lint.js";
import { formatLintText, formatGitHubAnnotation } from "../lib/output.js";
import { configureSdkAuth, errorStatusCode, is401, is402 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { ExitCode, exit, exitCodeForHttpStatus } from "../lib/exit-codes.js";
import { resolveCliSpecPathFromFlags } from "../lib/cli-spec-path.js";
import { resolvedPlatformApiUrl } from "../lib/platform-defaults.js";

const API_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function publishUsageExamples(): string {
  return [
    "Examples:",
    "  spec0 publish --spec-file ./openapi.yaml --name payments-api --version 1.0.0",
    "  spec0 publish ./openapi.yaml --name payments-api --semver --visibility published",
    "  spec0 publish --spec-file ./openapi.yaml --public-api-id <uuid> --semver",
    "  spec0 publish ./openapi.yaml --version staging-abc1234  # arbitrary tag accepted",
    "",
    "Use --version to pin an explicit tag (any string), or --semver to let the registry",
    "auto-bump the PATCH component of the previous stored semver. Both flags can be passed",
    "together — --version wins if set.",
  ].join("\n");
}

function formatPublishPublicText(output: {
  publicApiId: string;
  version: string;
  visibility: string;
  publicUrl: string;
  apiUrl: string;
}): string {
  const lines: string[] = [];
  lines.push(chalk.green("Published!"));
  lines.push(`  Public URL:  ${output.apiUrl}${output.publicUrl}`);
  lines.push(`  Version:     ${output.version}`);
  lines.push(`  Visibility:  ${output.visibility}`);
  lines.push(`  API ID:      ${output.publicApiId}`);
  return lines.join("\n");
}

export function registerPublishCommand(program: Command) {
  program
    .command("publish")
    .description(
      "Publish an API spec to the public registry (org-scoped, shareable URL, no team required)",
    )
    .argument("[spec-file]", "Path to OpenAPI spec (or use --spec-file / global --spec-file)")
    .option("--spec-file <path>", "Path to OpenAPI spec file")
    .option("--public-api-id <id>", "Existing public API ID to update")
    .option(
      "--name <slug>",
      "URL-safe API slug (e.g. payments-api). Inferred from spec info.title if omitted.",
    )
    .option("--title <title>", "Human-readable display title. Defaults to --name if omitted.")
    .option("--description <text>", "Short description of the API")
    .option(
      "--version <version>",
      "Explicit version tag for this publish. Accepts any string (semver, sha-prefixed, calendar tags, UUIDs).",
    )
    .option(
      "--semver",
      "Auto-bump PATCH from the previous stored semver. Falls through to spec info.version / 0.1.0 on first publish.",
    )
    .option(
      "--visibility <state>",
      "Visibility: draft | published | unlisted (default: published)",
      "published",
    )
    .option("--release-notes <text>", "Release notes for this version")
    .option("--git-sha <sha>", "Git commit SHA for provenance")
    .option("--strict", "Fail on any Spectral lint warning")
    .option("--skip-lint", "Skip lint gate")
    .option("--dry-run", "Validate only, do not call the API")
    .option("--format <fmt>", "Output format: text | json | github", "text")
    .option("--org <org>", "Override default org (UUID)")
    .action(
      async (
        specArg: string | undefined,
        opts: Record<string, string | boolean>,
        command: Command,
      ) => {
        const cwd = process.cwd();
        const specPath = resolveCliSpecPathFromFlags(
          command,
          cwd,
          opts.specFile as string | undefined,
          specArg,
        );

        if (!specPath || !existsSync(specPath)) {
          console.error(
            chalk.red(
              "Spec file not found. Pass a path via --spec-file, global spec0 --spec-file, or positional [spec-file].\n",
            ),
          );
          console.error(chalk.yellow(publishUsageExamples()));
          exit(ExitCode.USAGE);
        }

        const publicApiId = opts["publicApiId"] as string | undefined;
        const nameOpt = opts.name as string | undefined;
        const titleOpt = opts.title as string | undefined;
        const description = opts.description as string | undefined;
        const version = opts.version as string | undefined;
        const semver = !!(opts.semver as boolean);
        const visibilityRaw = (opts.visibility as string) ?? "published";
        const releaseNotes = opts["releaseNotes"] as string | undefined;
        const gitSha = (opts["gitSha"] as string | undefined) ?? "";
        const strict = !!(opts.strict as boolean);
        const skipLint = !!(opts.skipLint as boolean);
        const format = (opts.format as string) ?? "text";

        // Either flag is fine; both is fine (server resolves: --version wins);
        // neither is fine (server falls through to info.version or 0.1.0 default).
        // See ADR-0026.
        const hasVersion = typeof version === "string" && version.trim().length > 0;

        // Validate visibility
        const validVisibilities = ["draft", "published", "unlisted"];
        if (!validVisibilities.includes(visibilityRaw.toLowerCase())) {
          console.error(
            chalk.red(
              `Invalid --visibility '${visibilityRaw}'. Must be: draft | published | unlisted.`,
            ),
          );
          exit(ExitCode.USAGE);
        }
        const visibility = visibilityRaw.toUpperCase();

        const openapiSpec = readFileSync(specPath, "utf-8");

        // Infer slug from spec info.title if --name not provided and no --public-api-id
        let apiSlug = nameOpt?.trim();
        if (!apiSlug && !publicApiId) {
          try {
            const titleMatch = openapiSpec.match(/^\s*title:\s*(.+)$/m);
            if (titleMatch) {
              const inferred = toSlug(titleMatch[1].trim().replace(/['"]/g, ""));
              if (inferred && API_SLUG_PATTERN.test(inferred)) {
                if (format === "text") {
                  console.log(chalk.yellow(`No --name provided. Inferred slug: "${inferred}"`));
                }
                apiSlug = inferred;
              }
            }
          } catch {
            // ignore parse errors
          }
        }

        if (!publicApiId && (!apiSlug || !API_SLUG_PATTERN.test(apiSlug))) {
          console.error(
            chalk.red(
              `--name is required (or provide --public-api-id to update existing). ` +
                `Use a slug like 'payments-api' (lowercase letters, digits, hyphens).\n`,
            ),
          );
          console.error(chalk.yellow(publishUsageExamples()));
          exit(ExitCode.USAGE);
        }

        const title = titleOpt?.trim() || apiSlug;

        // -----------------------------------------------------------------------
        // Lint gate
        // -----------------------------------------------------------------------
        const spinner = ora("Linting...").start();
        if (!skipLint) {
          try {
            const lintResult = await runSpectral(specPath);
            spinner.succeed("Lint passed");
            if (format === "github") {
              for (const e of lintResult.errors) {
                console.log(formatGitHubAnnotation(specPath, e.line ?? 0, "error", e.message));
              }
              for (const w of lintResult.warnings) {
                console.log(formatGitHubAnnotation(specPath, w.line ?? 0, "warning", w.message));
              }
            } else if (format !== "json") {
              console.log(formatLintText(lintResult));
            }
            if (lintResult.errors.length > 0) {
              console.error(chalk.red("Lint errors block publish. Fix them or use --skip-lint."));
              exit(ExitCode.VALIDATION);
            }
            if (strict && lintResult.warnings.length > 0) {
              console.error(chalk.red("Strict mode: warnings block publish."));
              exit(ExitCode.VALIDATION);
            }
          } catch (e) {
            spinner.fail("Lint failed");
            console.error(e);
            exit(ExitCode.GENERIC);
          }
        } else {
          spinner.succeed("Lint skipped");
        }

        // -----------------------------------------------------------------------
        // Org context
        // -----------------------------------------------------------------------
        let ctx;
        try {
          ctx = requireOrgContext(opts.org as string | undefined);
        } catch (e) {
          console.error(chalk.red((e as Error).message));
          exit(ExitCode.AUTH_MISSING);
        }

        if (opts.dryRun) {
          const versionDesc = hasVersion
            ? `version=${version}`
            : semver
              ? "semver=auto-bump-patch"
              : "version=server-default";
          console.log(
            chalk.green(
              `Dry run — would publish apiSlug=${apiSlug ?? "-"} ${versionDesc} visibility=${visibility}`,
            ),
          );
          return;
        }

        // -----------------------------------------------------------------------
        // API call
        // -----------------------------------------------------------------------
        spinner.start("Publishing to public registry...");
        // Wire the @spec0/sdk-public-platform global config from the resolved
        // org context. The SDK targets `/api/v1/public/apis`; `configureSdkAuth`
        // sets `OpenAPI.BASE = ctx.apiUrl` (the host root), so the final URL is
        // `<host>/api/v1/public/apis`.
        configureSdkAuth(ctx);
        // `semver: boolean` is the new ADR-0026 shape. The SDK type still has the
        // legacy `versionBump` field; cast through `unknown` until the SDK is
        // regenerated from the updated `public-api-v1-spec.yaml`. The backend
        // already reads `semver` and ignores `versionBump` post-ADR-0026.
        const body = {
          publicApiId,
          apiSlug,
          title,
          description,
          visibility: visibility as Visibility,
          version: hasVersion ? version : undefined,
          semver,
          openapiSpec,
          gitSha: gitSha || undefined,
          releaseNotes: releaseNotes || undefined,
        } as unknown as PublicPublishRequestV1;

        try {
          // Public-registry publish moved off the legacy /cli/v1/* surface to the versioned
          // /api/v1/public/* surface (which has scope checks, rate limiting, and a stable API
          // contract). Same request/response shape; only the path differs.
          const reg = await PublicApisService.publishPublicApi({ requestBody: body });

          spinner.stop();

          const resolvedApiId = reg.publicApiId ?? "";
          const resolvedPublicUrl = reg.publicUrl ?? `/public/registry/-/${apiSlug ?? ""}`;
          const apiBaseUrl = resolvedPlatformApiUrl();
          // The server returns the *resolved* version — the explicit tag the caller
          // sent, OR the server-computed bump when `--bump` was used. Always prefer
          // it over the local `version` variable (which is undefined under --bump).
          const resolvedVersion = reg.version ?? version ?? "";

          if (format === "json") {
            console.log(
              JSON.stringify(
                {
                  publicApiId: resolvedApiId,
                  apiSlug: reg.apiSlug ?? apiSlug,
                  orgSlug: reg.orgSlug,
                  version: resolvedVersion,
                  visibility: reg.visibility ?? visibility,
                  created: reg.created ?? false,
                  versionCreated: reg.versionCreated ?? false,
                  publicUrl: `${apiBaseUrl}${resolvedPublicUrl}`,
                },
                null,
                2,
              ),
            );
          } else {
            console.log(
              formatPublishPublicText({
                publicApiId: resolvedApiId,
                version: resolvedVersion,
                visibility: reg.visibility ?? visibility,
                publicUrl: resolvedPublicUrl,
                apiUrl: apiBaseUrl,
              }),
            );
          }
        } catch (err) {
          spinner.stop();
          if (is401(err)) {
            console.error(chalk.red("Token invalid. Run 'spec0 auth login' to re-authenticate."));
            exit(ExitCode.AUTH_MISSING);
          }
          if (is402(err)) {
            // SDK ApiError exposes the parsed problem body on `err.body`; legacy `got`
            // errors used to expose it on `err.response.body`. Walk both.
            const sdkBody = (err as { body?: { detail?: string } })?.body;
            const legacyBody = (err as { response?: { body?: { detail?: string } } })?.response
              ?.body;
            const msg =
              sdkBody?.detail ??
              legacyBody?.detail ??
              "Plan limit exceeded. Upgrade your plan to publish more public APIs or use PUBLISHED visibility.";
            console.error(chalk.red(`Plan limit: ${msg}`));
            // 402 isn't in the stable table; PERMISSION_DENIED is closest semantic.
            exit(ExitCode.PERMISSION_DENIED);
          }
          const statusCode = errorStatusCode(err);
          if (statusCode === 409) {
            const conflictTag = version ?? "(server-computed)";
            console.error(
              chalk.red(
                `Version conflict: version tag '${conflictTag}' already exists with different content.`,
              ),
            );
            console.error(chalk.yellow("Use a new version tag (e.g. bump the patch version)."));
            exit(ExitCode.CONFLICT);
          }
          const sdkBody = (err as { body?: { detail?: string } })?.body;
          const legacyBody = (err as { response?: { body?: { detail?: string } } })?.response?.body;
          const msg =
            sdkBody?.detail ?? legacyBody?.detail ?? (err as Error).message ?? String(err);
          console.error(chalk.red(`Publish failed: ${msg}\n`));
          console.error(chalk.yellow(publishUsageExamples()));
          exit(exitCodeForHttpStatus(statusCode));
        }
      },
    );
}
