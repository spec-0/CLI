/**
 * spec0 api changelog <ref> — show what changed between published versions.
 *
 * Defaults to "latest vs previous". Pass --from / --to to diff specific tags.
 * Backed by /api-management/cli/v1/versions/{apiId}/diff.
 */

import { Command } from "commander";
import chalk from "chalk";
import { createOrgApiClient, is401 } from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode } from "../../lib/exit-codes.js";
import {
  emit,
  fail,
  resolveOutputContext,
  type OutputContext,
  type OutputOptions,
} from "../../lib/output/index.js";
import { resolveRef, resolveApiId } from "../../lib/ref-resolver.js";
import { getDefaultOrgId, getOrgConfig } from "../../lib/config.js";

interface VersionRow {
  tag?: string;
  publishedAt?: string;
}

interface VersionDiffResponse {
  fromTag?: string;
  toTag?: string;
  hasBreakingChanges?: boolean;
  changes?: Array<{ id?: string; level?: string; message?: string; text?: string }>;
  breakingChanges?: Array<{ id?: string; level?: string; message?: string; text?: string }>;
  changelog?: Record<string, unknown>;
}

interface ChangelogPayload {
  apiName: string;
  fromTag: string;
  toTag: string;
  hasBreakingChanges: boolean;
  changes: Array<{ id: string; level: string; message: string }>;
}

export function registerApiChangelogCommand(api: Command) {
  api
    .command("changelog <ref>")
    .description("Show changes between published versions of an API.")
    .option("--from <tag>", "Earlier version tag (default: previous published)")
    .option("--to <tag>", "Later version tag (default: latest published)")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, markdown, or yaml (default: text)")
    .action(
      async (ref: string, opts: OutputOptions & { from?: string; to?: string; org?: string }) => {
        const outCtx = resolveOutputContext(opts);

        let authCtx;
        try {
          authCtx = requireOrgContext(opts.org);
        } catch (e) {
          fail(outCtx, ExitCode.AUTH_MISSING, (e as Error).message, {
            hint: "Set SPEC0_TOKEN + SPEC0_ORG_ID, or run 'spec0 auth login'.",
          });
        }

        const defaultOrg = (() => {
          const id = process.env.PLATFORM_ORG_ID ?? getDefaultOrgId();
          return id ? getOrgConfig(id)?.name : undefined;
        })();

        let parsed;
        try {
          parsed = resolveRef(ref, { defaultOrg });
        } catch (e) {
          fail(outCtx, ExitCode.USAGE, (e as Error).message);
        }

        const client = createOrgApiClient(authCtx);

        try {
          const apiId = await resolveApiId(client, parsed);

          const { fromTag, toTag, apiName } = await pickTags(outCtx, client, apiId, parsed, opts);

          const params = new URLSearchParams({ fromTag, toTag });
          const res = (await client.getJson(
            `/api-management/cli/v1/versions/${encodeURIComponent(apiId)}/diff?${params.toString()}`,
          )) as VersionDiffResponse;

          const payload: ChangelogPayload = {
            apiName,
            fromTag,
            toTag,
            hasBreakingChanges: Boolean(res.hasBreakingChanges),
            changes: normaliseChanges(res),
          };

          // Format `markdown` is treated as `text` with a markdown body.
          if ((opts.output ?? "").toLowerCase() === "markdown") {
            process.stdout.write(renderChangelogMarkdown(payload) + "\n");
            return;
          }
          emit(outCtx, payload, renderChangelogText);
        } catch (err) {
          if (is401(err)) {
            fail(outCtx, ExitCode.AUTH_MISSING, "Token invalid or expired.", {
              hint: "Run 'spec0 auth login' or refresh SPEC0_TOKEN.",
            });
          }
          if ((err as Error).message?.includes("No API named")) {
            fail(outCtx, ExitCode.NOT_FOUND, (err as Error).message, {
              hint: "Run 'spec0 api list' to see what exists in this org.",
            });
          }
          fail(outCtx, ExitCode.GENERIC, `api changelog failed: ${(err as Error).message}`);
        }
      },
    );
}

interface TagPickClient {
  getJson(path: string): Promise<unknown>;
}

async function pickTags(
  ctx: OutputContext,
  client: TagPickClient,
  apiId: string,
  parsed: ReturnType<typeof resolveRef>,
  opts: { from?: string; to?: string },
): Promise<{ fromTag: string; toTag: string; apiName: string }> {
  if (opts.from && opts.to) {
    const apiName = parsed.kind === "name" ? parsed.api : apiId;
    return { fromTag: opts.from, toTag: opts.to, apiName };
  }

  // Fall back to the registry to pull the version list. Need org slug + api name
  // for the registry path.
  if (parsed.kind !== "name" || !parsed.org) {
    fail(
      ctx,
      ExitCode.USAGE,
      "Pass --from <tag> --to <tag>, or use a ref of the form '<org>/<api>' so we can list versions.",
    );
  }
  const path = `/registry/${encodeURIComponent(parsed.org)}/${encodeURIComponent(parsed.api)}/versions`;
  const versions = (await client.getJson(path)) as VersionRow[];
  if (versions.length < 2) {
    fail(
      ctx,
      ExitCode.NOT_FOUND,
      `Need at least two published versions to diff. ${parsed.api} has ${versions.length}.`,
    );
  }
  // versions are sorted newest-first by the platform.
  const toTag = opts.to ?? versions[0].tag;
  const fromTag = opts.from ?? versions[1].tag;
  if (!toTag || !fromTag) {
    fail(ctx, ExitCode.GENERIC, "Could not determine version tags from the registry.");
  }
  return { fromTag, toTag, apiName: parsed.api };
}

function normaliseChanges(res: VersionDiffResponse): ChangelogPayload["changes"] {
  const list = res.breakingChanges ?? res.changes ?? [];
  return list.map((c) => ({
    id: String(c.id ?? c.text ?? ""),
    level: String(c.level ?? "info"),
    message: String(c.message ?? c.text ?? ""),
  }));
}

function renderChangelogText(p: ChangelogPayload): string {
  const lines: string[] = [];
  const header = `${p.apiName}: ${p.fromTag} → ${p.toTag}`;
  lines.push(chalk.bold(header));
  lines.push(
    p.hasBreakingChanges
      ? chalk.red(`  ✗ ${p.changes.length} breaking change${p.changes.length === 1 ? "" : "s"}`)
      : chalk.green(`  ✓ no breaking changes`),
  );
  if (p.changes.length) {
    lines.push("");
    for (const c of p.changes) {
      const tag = c.level === "error" ? chalk.red("[breaking]") : chalk.gray(`[${c.level}]`);
      lines.push(`  ${tag} ${c.id}${c.message ? `: ${c.message}` : ""}`);
    }
  }
  return lines.join("\n");
}

function renderChangelogMarkdown(p: ChangelogPayload): string {
  const lines: string[] = [];
  lines.push(`## ${p.apiName} — ${p.fromTag} → ${p.toTag}`);
  lines.push("");
  if (p.hasBreakingChanges) {
    lines.push(`**${p.changes.length} breaking change(s).**`);
  } else {
    lines.push("No breaking changes.");
  }
  if (p.changes.length) {
    lines.push("");
    for (const c of p.changes) {
      lines.push(`- \`${c.id}\` — ${c.message || "(no description)"}`);
    }
  }
  return lines.join("\n");
}
