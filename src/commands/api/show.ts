/**
 * spec0 api show <ref> — single-API metadata.
 *
 * Backed by GET /apis/{apiId}/summary. Resolves <ref> via ref-resolver:
 * accepts <org>/<api>, bare <api>, or a UUID.
 */

import { Command } from "commander";
import chalk from "chalk";
import { createOrgApiClient, is401 } from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode } from "../../lib/exit-codes.js";
import { emit, fail, resolveOutputContext, type OutputOptions } from "../../lib/output/index.js";
import { resolveRef, resolveApiId } from "../../lib/ref-resolver.js";
import { getDefaultOrgId, getOrgConfig } from "../../lib/config.js";

interface ApiSummary {
  apiId?: string;
  apiName?: string;
  version?: string;
  description?: string;
  status?: string;
  teamId?: string;
  teamName?: string;
  apiURL?: string;
  createdAt?: string;
  updatedAt?: string;
  specSourceType?: string;
  specGithubRepo?: string;
  githubBlobUrl?: string;
  subscriberCount?: number;
  operations?: Array<{ method?: string; path?: string }>;
  apiEnvConfigs?: Array<{ envConfigId?: string; environment?: { name?: string }; url?: string }>;
}

interface ApiSummaryResponse {
  api?: ApiSummary;
}

export function registerApiShowCommand(api: Command) {
  api
    .command("show <ref>")
    .description("Show metadata for a single API (no spec body).")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(async (ref: string, opts: OutputOptions & { org?: string }) => {
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
        const res = (await client.getJson(`/apis/${apiId}/summary`)) as ApiSummaryResponse;
        if (!res.api) {
          fail(outCtx, ExitCode.NOT_FOUND, `No API found for ref '${ref}'.`, {
            hint: "Run 'spec0 api list' to see what exists in this org.",
          });
        }
        emit(outCtx, res.api, renderApiShowText);
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
        fail(outCtx, ExitCode.GENERIC, `api show failed: ${(err as Error).message}`);
      }
    });
}

function renderApiShowText(api: ApiSummary): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`${api.apiName ?? "?"} ${chalk.gray(`v${api.version ?? "?"}`)}`));
  if (api.description) lines.push(api.description);
  lines.push("");
  lines.push(`  status:       ${api.status ?? "—"}`);
  lines.push(`  team:         ${api.teamName ?? "—"}`);
  lines.push(`  apiId:        ${api.apiId ?? "—"}`);
  lines.push(`  operations:   ${api.operations?.length ?? 0}`);
  lines.push(`  environments: ${api.apiEnvConfigs?.length ?? 0}`);
  lines.push(`  subscribers:  ${api.subscriberCount ?? 0}`);
  if (api.specSourceType) lines.push(`  specSource:   ${api.specSourceType}`);
  if (api.githubBlobUrl) lines.push(`  github:       ${api.githubBlobUrl}`);
  if (api.updatedAt) lines.push(`  updated:      ${api.updatedAt}`);
  return lines.join("\n");
}
