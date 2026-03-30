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
import { runSpectral } from "../lib/lint.js";
import { formatLintText, formatGitHubAnnotation } from "../lib/output.js";
import { createOrgApiClient, is401, is402 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { resolveCliSpecPathFromFlags } from "../lib/cli-spec-path.js";
import { resolvedPlatformApiUrl } from "../lib/platform-defaults.js";

// Types for the public-publish API (mirrors public-registry-api-spec.yaml schemas)
interface PublicPublishRequest {
  publicApiId?: string;
  apiSlug?: string;
  title?: string;
  description?: string;
  visibility?: string;
  version: string;
  openapiSpec: string;
  gitSha?: string;
  releaseNotes?: string;
}

interface PublicPublishResponse {
  publicApiId?: string;
  apiSlug?: string;
  orgSlug?: string;
  version?: string;
  visibility?: string;
  created?: boolean;
  versionCreated?: boolean;
  publicUrl?: string;
}

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
    "  spec0 publish --spec-file ./openapi.yaml --name payments-api --version v1.0.0",
    "  spec0 publish ./openapi.yaml --name payments-api --version v1.0.0 --visibility published",
    "  spec0 publish --spec-file ./openapi.yaml --public-api-id <uuid> --version v1.1.0",
    "  spec0 publish ./openapi.yaml --version v1.0.0  # slug inferred from spec info.title",
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
      "Publish an API spec to the public registry (org-scoped, shareable URL, no team required)"
    )
    .argument("[spec-file]", "Path to OpenAPI spec (or use --spec-file / global --spec-file)")
    .option("--spec-file <path>", "Path to OpenAPI spec file")
    .option("--public-api-id <id>", "Existing public API ID to update")
    .option(
      "--name <slug>",
      "URL-safe API slug (e.g. payments-api). Inferred from spec info.title if omitted."
    )
    .option("--title <title>", "Human-readable display title. Defaults to --name if omitted.")
    .option("--description <text>", "Short description of the API")
    .requiredOption("--version <version>", "Version tag (e.g. v1.0.0)")
    .option(
      "--visibility <state>",
      "Visibility: draft | published | unlisted (default: published)",
      "published"
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
        command: Command
      ) => {
        const cwd = process.cwd();
        const specPath = resolveCliSpecPathFromFlags(
          command,
          cwd,
          opts.specFile as string | undefined,
          specArg
        );

        if (!specPath || !existsSync(specPath)) {
          console.error(
            chalk.red(
              "Spec file not found. Pass a path via --spec-file, global spec0 --spec-file, or positional [spec-file].\n"
            )
          );
          console.error(chalk.yellow(publishUsageExamples()));
          process.exit(1);
        }

        const publicApiId = opts["publicApiId"] as string | undefined;
        const nameOpt = opts.name as string | undefined;
        const titleOpt = opts.title as string | undefined;
        const description = opts.description as string | undefined;
        const version = opts.version as string;
        const visibilityRaw = (opts.visibility as string) ?? "published";
        const releaseNotes = opts["releaseNotes"] as string | undefined;
        const gitSha = (opts["gitSha"] as string | undefined) ?? "";
        const strict = !!(opts.strict as boolean);
        const skipLint = !!(opts.skipLint as boolean);
        const format = (opts.format as string) ?? "text";

        // Validate visibility
        const validVisibilities = ["draft", "published", "unlisted"];
        if (!validVisibilities.includes(visibilityRaw.toLowerCase())) {
          console.error(
            chalk.red(`Invalid --visibility '${visibilityRaw}'. Must be: draft | published | unlisted.`)
          );
          process.exit(1);
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
                `Use a slug like 'payments-api' (lowercase letters, digits, hyphens).\n`
            )
          );
          console.error(chalk.yellow(publishUsageExamples()));
          process.exit(1);
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
              process.exit(1);
            }
            if (strict && lintResult.warnings.length > 0) {
              console.error(chalk.red("Strict mode: warnings block publish."));
              process.exit(1);
            }
          } catch (e) {
            spinner.fail("Lint failed");
            console.error(e);
            process.exit(1);
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
          process.exit(1);
        }

        if (opts.dryRun) {
          console.log(
            chalk.green(
              `Dry run — would publish apiSlug=${apiSlug ?? "-"} version=${version} visibility=${visibility}`
            )
          );
          return;
        }

        // -----------------------------------------------------------------------
        // API call
        // -----------------------------------------------------------------------
        spinner.start("Publishing to public registry...");
        const client = createOrgApiClient(ctx);
        const body: PublicPublishRequest = {
          publicApiId,
          apiSlug,
          title,
          description,
          visibility,
          version,
          openapiSpec,
          gitSha: gitSha || undefined,
          releaseNotes: releaseNotes || undefined,
        };

        try {
          const reg = (await client.postJson(
            "/api-management/cli/v1/public-publish",
            body
          )) as PublicPublishResponse;

          spinner.stop();

          const resolvedApiId = reg.publicApiId ?? "";
          const resolvedPublicUrl = reg.publicUrl ?? `/public/registry/-/${apiSlug ?? ""}`;
          const apiBaseUrl = resolvedPlatformApiUrl();

          if (format === "json") {
            console.log(
              JSON.stringify(
                {
                  publicApiId: resolvedApiId,
                  apiSlug: reg.apiSlug ?? apiSlug,
                  orgSlug: reg.orgSlug,
                  version,
                  visibility: reg.visibility ?? visibility,
                  created: reg.created ?? false,
                  versionCreated: reg.versionCreated ?? false,
                  publicUrl: `${apiBaseUrl}${resolvedPublicUrl}`,
                },
                null,
                2
              )
            );
          } else {
            console.log(
              formatPublishPublicText({
                publicApiId: resolvedApiId,
                version,
                visibility: reg.visibility ?? visibility,
                publicUrl: resolvedPublicUrl,
                apiUrl: apiBaseUrl,
              })
            );
          }
        } catch (err) {
          spinner.stop();
          if (is401(err)) {
            console.error(chalk.red("Token invalid. Run 'spec0 auth login' to re-authenticate."));
            process.exit(1);
          }
          if (is402(err)) {
            const msg =
              (err as { response?: { body?: { detail?: string } } })?.response?.body?.detail ??
              "Plan limit exceeded. Upgrade your plan to publish more public APIs or use PUBLISHED visibility.";
            console.error(chalk.red(`Plan limit: ${msg}`));
            process.exit(1);
          }
          const statusCode = (err as { response?: { statusCode?: number } })?.response?.statusCode;
          if (statusCode === 409) {
            console.error(
              chalk.red(
                `Version conflict: version tag '${version}' already exists with different content.`
              )
            );
            console.error(chalk.yellow("Use a new version tag (e.g. bump the patch version)."));
            process.exit(1);
          }
          const msg =
            (err as { response?: { body?: { detail?: string } }; message?: string })?.response
              ?.body?.detail ??
            (err as Error).message ??
            String(err);
          console.error(chalk.red(`Publish failed: ${msg}\n`));
          console.error(chalk.yellow(publishUsageExamples()));
          process.exit(1);
        }
      }
    );
}
