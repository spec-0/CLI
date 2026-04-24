/**
 * spec0 push — zero-config push of an OpenAPI spec to the platform (team-scoped, private).
 *
 * The primary publish command for the GitOps workflow:
 *   spec0 push openapi.yaml
 *   spec0 push openapi.yaml --name payment-api
 *   spec0 push openapi.yaml --semver
 *
 * Name resolution order: --name > basename(specFilePath) > error
 * Version resolution order: --version > info.version in spec > default 0.1.0
 * Team resolution order: --team > "Unassigned APIs" (backend default, reassign later)
 * Git SHA: --git-sha > CI env > local `git log -1 -- <file>`
 *
 * `spec0 register` is a backward-compat alias for this command.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { existsSync, readFileSync } from "fs";
import { basename, extname, relative, resolve } from "path";
import { runSpectral } from "../lib/lint.js";
import { formatLintText, formatPublishText, formatGitHubAnnotation } from "../lib/output.js";
import { createOrgApiClient, is401, is402, extractErrorMessage } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { resolveCliSpecPathFromFlags } from "../lib/cli-spec-path.js";
import { resolvedPlatformAppUrl } from "../lib/platform-defaults.js";
import { detectCI, getGitShaForFile, getGitBranch } from "../lib/ci-detect.js";
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
  if (!t) return "Missing --team value.";
  if (isUuid(t)) return null;
  if (!TEAM_SLUG_PATTERN.test(t)) {
    return `Invalid --team '${team}'. Use a UUID or slug like 'platform-team' (lowercase, hyphens, no spaces).`;
  }
  return null;
}

/** Derive API name from spec filename: "api/payment-api.yaml" → "payment-api" */
function nameFromSpecPath(specPath: string): string | null {
  const base = basename(specPath);
  const ext = extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  // Only return if it already looks like a valid slug
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

function usageExamples(cmd: string): string {
  return [
    "Examples:",
    `  spec0 ${cmd} openapi.yaml`,
    `  spec0 ${cmd} openapi.yaml --name payment-api`,
    `  spec0 ${cmd} openapi.yaml --name payment-api --team platform-team`,
    `  spec0 ${cmd} openapi.yaml --semver`,
    `  spec0 ${cmd} openapi.yaml --version 1.2.0 --git-sha $(git rev-parse HEAD)`,
  ].join("\n");
}

async function runPush(
  cmdName: string,
  specArg: string | undefined,
  opts: Record<string, string | boolean>,
  command: Command,
) {
  const cwd = process.cwd();
  const specPath = resolveCliSpecPathFromFlags(
    command,
    cwd,
    opts.specFile as string | undefined,
    specArg,
  );

  if (!specPath || !existsSync(specPath)) {
    console.error(
      chalk.red("Spec file not found. Pass a path as the first argument or via --spec-file.\n"),
    );
    console.error(chalk.yellow(usageExamples(cmdName)));
    process.exit(1);
  }

  const apiId = opts["apiId"] as string | undefined;
  const nameOpt = opts.name as string | undefined;
  const team = opts.team as string | undefined;
  const versionOpt = opts.version as string | undefined;
  const semver = !!(opts.semver as boolean);
  const strict = !!(opts.strict as boolean);
  const skipLint = !!(opts.skipLint as boolean);
  const verbose = !!(opts.verbose as boolean);
  const format = (opts.format as string) ?? "text";
  const dryRun = !!(opts.dryRun as boolean);

  const vLog = (msg: string) => {
    if (verbose) console.error(chalk.gray(`[verbose] ${msg}`));
  };

  // ── Name resolution ────────────────────────────────────────────────────────
  // --name > basename(specFilePath) — never from info.title
  const resolvedName = nameOpt?.trim() ?? nameFromSpecPath(specPath);
  if (!apiId && !resolvedName) {
    console.error(chalk.red("Cannot derive API name from spec path. Use --name payment-api.\n"));
    console.error(chalk.yellow(usageExamples(cmdName)));
    process.exit(1);
  }

  // ── Team validation (optional) ─────────────────────────────────────────────
  if (team) {
    const teamErr = validateTeamArg(team);
    if (teamErr) {
      console.error(chalk.red(`${teamErr}\n`));
      process.exit(1);
    }
  }

  // ── Git SHA resolution ─────────────────────────────────────────────────────
  // Priority: --git-sha flag > CI env > local git log
  let gitSha = (opts["gitSha"] as string | undefined) ?? "";
  let githubRepo = (opts["githubRepo"] as string | undefined) ?? "";
  let githubBranch = (opts["githubBranch"] as string | undefined) ?? "";

  if (!gitSha) {
    const ci = detectCI();
    if (ci?.gitSha) {
      gitSha = ci.gitSha;
      githubRepo = githubRepo || (ci.githubRepo ?? "");
      githubBranch = githubBranch || ci.branch;
      vLog(`git sha from CI: ${gitSha.slice(0, 8)}…`);
    } else {
      // Local git: SHA of last commit that touched this spec file
      const localSha = getGitShaForFile(specPath);
      if (localSha) {
        gitSha = localSha;
        githubBranch = githubBranch || (getGitBranch() ?? "");
        vLog(`git sha from local git: ${gitSha.slice(0, 8)}…`);
      }
    }
  }

  // ── Lint gate ─────────────────────────────────────────────────────────────
  const spinner = ora("Linting…").start();
  if (!skipLint) {
    try {
      const lintResult = await runSpectral(specPath);
      if (lintResult.errors.length === 0) {
        spinner.succeed("Lint passed");
      } else {
        spinner.fail("Lint failed");
      }
      if (format === "github") {
        for (const e of lintResult.errors)
          console.log(formatGitHubAnnotation(specPath, e.line ?? 0, "error", e.message));
        for (const w of lintResult.warnings)
          console.log(formatGitHubAnnotation(specPath, w.line ?? 0, "warning", w.message));
      } else if (format !== "json") {
        console.log(formatLintText(lintResult));
      }
      if (lintResult.errors.length > 0) {
        console.error(chalk.red("Lint errors block push. Fix them or use --skip-lint."));
        process.exit(1);
      }
      if (strict && lintResult.warnings.length > 0) {
        console.error(chalk.red("Strict mode: lint warnings block push."));
        process.exit(1);
      }
    } catch (e) {
      spinner.fail("Lint check failed");
      console.error(e);
      process.exit(1);
    }
  } else {
    spinner.succeed("Lint skipped");
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  let ctx;
  try {
    ctx = requireOrgContext(opts.org as string | undefined);
  } catch (e) {
    console.error(chalk.red((e as Error).message));
    process.exit(1);
  }

  const openapiSpec = readFileSync(specPath, "utf-8");
  const specFilePath = relative(cwd, resolve(specPath));

  if (dryRun) {
    console.log(
      chalk.green(
        `Dry run — would push: name=${resolvedName ?? apiId ?? "new"} team=${team ?? "(unassigned)"} version=${versionOpt ?? "(from spec)"} sha=${gitSha ? gitSha.slice(0, 8) + "…" : "none"}`,
      ),
    );
    return;
  }

  // ── API call ─────────────────────────────────────────────────────────────
  const client = createOrgApiClient(ctx);
  const body: CliPublishRequest = {
    apiId,
    name: resolvedName ?? undefined,
    team: team || undefined,
    version: versionOpt || undefined,
    openapiSpec,
    gitSha: gitSha || undefined,
    githubRepo: githubRepo || undefined,
    githubBranch: githubBranch || undefined,
    specFilePath,
    semver,
  };

  vLog(`POST ${ctx.apiUrl}/api-management/cli/v1/publish`);
  vLog(
    `payload: name=${resolvedName} team=${team ?? "(unassigned)"} version=${versionOpt ?? "(from spec)"} sha=${gitSha ? gitSha.slice(0, 8) + "…" : "none"} semver=${semver}`,
  );

  const pushSpinner = ora("Pushing…").start();
  try {
    const reg = (await client.postJson(
      "/api-management/cli/v1/publish",
      body,
    )) as CliPublishResponse;

    pushSpinner.stop();

    vLog(
      `response: apiId=${reg.apiId} apiName=${reg.apiName ?? "-"} version=${reg.version ?? "-"} created=${reg.created} noChanges=${reg.noChanges} versionUnchanged=${reg.versionUnchanged}`,
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
      /* best-effort */
    }

    const displayVersion = reg.version ?? versionOpt ?? "?";
    const displayName = reg.apiName ?? resolvedName ?? resolvedApiId;

    if (format === "json") {
      console.log(
        JSON.stringify(
          {
            apiId: resolvedApiId,
            apiName: reg.apiName ?? null,
            version: displayVersion,
            created: reg.created ?? false,
            versionCreated: reg.versionCreated ?? false,
            noChanges: reg.noChanges ?? false,
            versionUnchanged: reg.versionUnchanged ?? false,
            versionUnchangedHint: reg.versionUnchangedHint ?? null,
            teamName: reg.teamName ?? null,
            orgSlug: reg.orgSlug ?? null,
            registryUrl: reg.registryUrl ?? null,
            specUrl,
            mockUrl: mockUrl ?? null,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(
        formatPublishText({
          apiId: resolvedApiId,
          apiName: displayName,
          version: displayVersion,
          specUrl,
          mockUrl,
          teamName: reg.teamName,
          registryUrl: reg.registryUrl,
          noChanges: reg.noChanges,
          versionUnchanged: reg.versionUnchanged,
          versionUnchangedHint: reg.versionUnchangedHint,
          created: reg.created,
        }),
      );
    }
  } catch (err) {
    pushSpinner.fail("Push failed");
    if (is401(err)) {
      const errBody = (err as { response?: { body?: unknown } })?.response?.body;
      const errCode =
        typeof errBody === "object" && errBody !== null
          ? (errBody as Record<string, unknown>)["error"]
          : undefined;
      if (errCode === "API_KEY_EXPIRED") {
        console.error(
          chalk.red("Your API key has expired. Run 'spec0 auth login' to re-authenticate."),
        );
      } else {
        console.error(
          chalk.red("Authentication failed. Run 'spec0 auth login' to re-authenticate."),
        );
      }
      process.exit(1);
    }
    if (is402(err)) {
      const msg = extractErrorMessage(err) ?? "You've reached your plan limit.";
      console.error(chalk.red(`Plan limit reached: ${msg}`));
      console.error(chalk.yellow("Upgrade your plan at your org settings."));
      process.exit(1);
    }
    const detail = extractErrorMessage(err) ?? (err as Error).message ?? String(err);
    console.error(chalk.red(`Push failed: ${detail}\n`));
    console.error(chalk.yellow(usageExamples(cmdName)));
    process.exit(1);
  }
}

export function registerPushCommand(program: Command) {
  program
    .command("push")
    .description("Push an OpenAPI spec to the platform (team-scoped, private)")
    .argument("[spec-file]", "Path to OpenAPI spec file (or use --spec-file)")
    .option("--spec-file <path>", "Path to OpenAPI spec file")
    .option("--name <name>", "API name (kebab-case). Defaults to spec filename if omitted.")
    .option("--team <team>", "Team UUID or slug. Defaults to 'Unassigned APIs' if omitted.")
    .option("--version <version>", "Version tag (e.g. 1.2.0). Defaults to info.version in spec.")
    .option("--api-id <id>", "Existing API UUID to update (backward compat; prefer --name)")
    .option("--semver", "Auto-compute next semver via oasdiff diff classification")
    .option("--git-sha <sha>", "Git commit SHA (auto-detected if .git is present)")
    .option("--github-repo <repo>", "GitHub repository URL for provenance")
    .option("--github-branch <branch>", "GitHub branch for provenance")
    .option("--strict", "Fail on any Spectral lint warning")
    .option("--skip-lint", "Skip lint gate")
    .option("--dry-run", "Validate and print what would be sent, without pushing")
    .option("--verbose", "Print verbose request/response logs")
    .option("--format <fmt>", "Output format: text, json, github", "text")
    .option("--org <org>", "Override default org (UUID)")
    .action(async (specArg, opts, command) => {
      await runPush("push", specArg, opts, command);
    });
}
