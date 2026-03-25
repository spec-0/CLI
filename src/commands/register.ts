/**
 * winspect register — upload OpenAPI spec (lint gate + CLI publish API + mock URL hint)
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { existsSync, readFileSync } from "fs";
import { runSpectral } from "../lib/lint.js";
import { formatLintText, formatPublishText, formatGitHubAnnotation } from "../lib/output.js";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { resolveCliSpecPathFromFlags } from "../lib/cli-spec-path.js";
import { resolvedPlatformAppUrl } from "../lib/platform-defaults.js";
import type { components, paths } from "../types.js";

type CliPublishRequest =
  paths["/api-management/cli/v1/publish"]["post"]["requestBody"]["content"]["application/json"];
type CliPublishResponse =
  paths["/api-management/cli/v1/publish"]["post"]["responses"][200]["content"]["application/json"];
type MockRow = components["schemas"]["MockItem"];

const TEAM_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function validateTeamArg(team: string): string | null {
  const t = team.trim();
  if (!t) {
    return "Missing --team value.";
  }
  if (isUuid(t)) {
    return null;
  }
  if (!TEAM_SLUG_PATTERN.test(t)) {
    return `Invalid --team '${team}'. Use a team UUID or a slug like 'platform-team' (lowercase letters, numbers, hyphens; no spaces).`;
  }
  return null;
}

function registerUsageExamples(): string {
  return [
    "Examples:",
    "  winspect register --spec-file ./openapi.yaml --name order-api --team platform-team --version 1.0.0",
    "  winspect --spec-file /abs/path/openapi.yaml register --name order-api --team platform-team --version 1.0.0",
    "  winspect register ./openapi.yaml --name order-api --team platform-team --version 1.0.0",
    "  winspect register --spec-file ./openapi.yaml --api-id 123e4567-e89b-12d3-a456-426614174000 --version 1.0.1",
  ].join("\n");
}

export function registerRegisterCommand(program: Command) {
  program
    .command("register")
    .description("Register or update an API spec on Winspect (explicit args only)")
    .argument("[spec-file]", "Path to OpenAPI spec (or use --spec-file / global --spec-file)")
    .option("--spec-file <path>", "Path to OpenAPI spec file")
    .option("--api-id <id>", "Existing API ID to update")
    .option("--name <name>", "API name (required when --api-id is not provided)")
    .option(
      "--team <team>",
      "Team UUID or slug (required when --api-id is not provided)"
    )
    .requiredOption("--version <version>", "API version tag (for example 1.2.0)")
    .option("--strict", "Fail on any Spectral lint warning")
    .option("--dry-run", "Validate only, do not call the API")
    .option("--verbose", "Print verbose request/response logs")
    .option("--format <fmt>", "Output format: text, json, github", "text")
    .option("--org <org>", "Override default org (UUID)")
    .option("--skip-lint", "Skip lint gate")
    .option("--git-sha <sha>", "Git commit SHA for provenance")
    .option("--github-repo <repo>", "GitHub repository URL for provenance")
    .option("--github-branch <branch>", "GitHub branch for provenance")
    .action(async (specArg: string | undefined, opts: Record<string, string | boolean>, command: Command) => {
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
            "Spec file not found. Pass a path via --spec-file, global winspect --spec-file, or positional [spec-file].\n"
          )
        );
        console.error(chalk.yellow(registerUsageExamples()));
        process.exit(1);
      }

      const apiId = opts["apiId"] as string | undefined;
      const name = opts.name as string | undefined;
      const team = opts.team as string | undefined;
      const version = opts.version as string;
      const strict = !!(opts.strict as boolean);
      const skipLint = !!(opts.skipLint as boolean);
      const verbose = !!(opts.verbose as boolean);
      const format = (opts.format as string) ?? "text";
      const gitSha = (opts["gitSha"] as string | undefined) ?? "";
      const githubRepo = (opts["githubRepo"] as string | undefined) ?? "";
      const githubBranch = (opts["githubBranch"] as string | undefined) ?? "";
      const vLog = (msg: string) => {
        if (verbose) {
          console.error(chalk.gray(`[verbose] ${msg}`));
        }
      };

      if (!apiId && (!name || !team)) {
        console.error(
          chalk.red("For new APIs, provide both --name and --team (or pass --api-id).\n")
        );
        console.error(chalk.yellow(registerUsageExamples()));
        process.exit(1);
      }
      if (team) {
        const teamErr = validateTeamArg(team);
        if (teamErr) {
          console.error(chalk.red(`${teamErr}\n`));
          console.error(chalk.yellow(registerUsageExamples()));
          process.exit(1);
        }
      }

      const spinner = ora("Registering...").start();

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
          } else if (format !== "json") console.log(formatLintText(lintResult));
          if (lintResult.errors.length > 0) {
            console.error(chalk.red("Lint errors block register. Fix them or use --skip-lint."));
            process.exit(1);
          }
          if (strict && lintResult.warnings.length > 0) {
            console.error(chalk.red("Strict mode: warnings block register."));
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

      let ctx;
      try {
        ctx = requireOrgContext(opts.org as string | undefined);
      } catch (e) {
        console.error(chalk.red((e as Error).message));
        process.exit(1);
      }

      const openapiSpec = readFileSync(specPath, "utf-8");

      if (opts.dryRun) {
        console.log(
          chalk.green(
            `Dry run — would register apiId=${apiId ?? "new"} name=${name ?? "-"} team=${team ?? "-"} version=${version}`
          )
        );
        return;
      }

      const client = createOrgApiClient(ctx);
      const body: CliPublishRequest = {
        apiId,
        name,
        team,
        version,
        openapiSpec,
        gitSha,
        githubRepo,
        githubBranch,
        specFilePath: specPath.replace(cwd + "/", ""),
      };
      vLog(`POST ${ctx.apiUrl}/api-management/cli/v1/publish`);
      vLog(
        `register payload: apiId=${apiId ?? "<new>"} name=${name ?? "-"} team=${team ?? "-"} version=${version} specFilePath=${body.specFilePath ?? "-"}`
      );

      try {
        const reg = (await client.postJson(
          "/api-management/cli/v1/publish",
          body
        )) as CliPublishResponse;
        vLog(
          `register response: apiId=${reg.apiId ?? "-"} created=${String(
            reg.created ?? false
          )} versionCreated=${String(reg.versionCreated ?? false)}`
        );
        const resolvedApiId = reg.apiId ?? "";
        const appBase = resolvedPlatformAppUrl();
        const specUrl = `${appBase}/apis/${resolvedApiId}`;

        let mockUrl: string | undefined;
        try {
          const mocks = (await client.getJson("/api-management/cli/v1/mocks")) as MockRow[];
          const hit = mocks.find((m) => m.apiId === resolvedApiId);
          if (hit?.mockBaseUrl) {
            mockUrl = `${ctx.apiUrl}${hit.mockBaseUrl}`;
          }
        } catch {
          /* optional */
        }

        if (format === "json") {
          console.log(
            JSON.stringify(
              {
                apiId: resolvedApiId,
                version,
                created: reg.created ?? false,
                versionCreated: reg.versionCreated ?? false,
                specUrl,
                mockUrl: mockUrl ?? null,
                breakingChanges: [],
                lintScore: null,
              },
              null,
              2
            )
          );
        } else {
          console.log(
            formatPublishText({
              apiId: resolvedApiId,
              version,
              specUrl,
              mockUrl,
            })
          );
        }
      } catch (err) {
        const statusCode = (err as { response?: { statusCode?: number } })?.response?.statusCode;
        if (statusCode) {
          vLog(`register failed with HTTP ${statusCode}`);
        }
        if (is401(err)) {
          console.error(
            chalk.red("Token invalid. Run 'winspect auth login' to re-authenticate.")
          );
          process.exit(1);
        }
        const msg =
          (err as { response?: { body?: { detail?: string } }; message?: string })?.response?.body
            ?.detail ??
          (err as Error).message ??
          String(err);
        console.error(chalk.red(`Register failed: ${msg}\n`));
        console.error(chalk.yellow(registerUsageExamples()));
        process.exit(1);
      }
    });
}
