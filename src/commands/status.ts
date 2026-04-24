/**
 * spec0 status — org overview (APIs, mocks, teams, plan)
 */

import { Command } from "commander";
import chalk from "chalk";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { getDefaultOrgId, getOrgConfig } from "../lib/config.js";
import { ExitCode, exit } from "../lib/exit-codes.js";
import { emit, resolveOutputContext, type OutputOptions } from "../lib/output/index.js";
import { renderTable } from "../lib/output/table.js";
import { warnDeprecated } from "../lib/deprecation.js";
import type { components } from "../types.js";

type MockRow = components["schemas"]["MockItem"];

interface OrgSummary {
  apiCount?: number;
  mockServerCount?: number;
  teamCount?: number;
  plan?: string;
}

interface StatusPayload {
  orgName: string;
  apiUrl: string;
  apiCount?: number;
  mockServerCount?: number;
  teamCount?: number;
  plan?: string;
  mocks: MockRow[];
}

export function registerStatusCommand(program: Command) {
  program
    .command("status")
    .description("Show org overview: API count, mock servers, teams, plan")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .option("--json", "Deprecated. Use --output=json instead.")
    .action(async (opts: OutputOptions & { org?: string }) => {
      if (opts.json) {
        warnDeprecated({
          what: "the --json flag on `spec0 status`",
          removeIn: "v1.0.0",
          alternative: "--output=json",
        });
      }
      const ctx = resolveOutputContext(opts);

      const orgId = process.env.PLATFORM_ORG_ID ?? getDefaultOrgId();
      if (!orgId || !getOrgConfig(orgId)) {
        exit(ExitCode.AUTH_MISSING, "Not logged in. Run 'spec0 auth login' or set SPEC0_TOKEN.");
      }
      const org = getOrgConfig(orgId)!;

      let authCtx;
      try {
        authCtx = requireOrgContext(opts.org);
      } catch (e) {
        exit(ExitCode.AUTH_MISSING, (e as Error).message);
      }

      const client = createOrgApiClient(authCtx);
      try {
        const summary = (await client.getJson("/api-management/cli/v1/org-summary")) as OrgSummary;
        const mocks = (await client.getJson("/api-management/cli/v1/mocks")) as MockRow[];

        const payload: StatusPayload = {
          orgName: org.name,
          apiUrl: org.apiUrl,
          ...summary,
          mocks,
        };

        emit(ctx, payload, (data) => renderStatusText(data, org.keyName));
      } catch (err) {
        if (is401(err)) {
          exit(ExitCode.AUTH_MISSING, "Token invalid or expired. Run 'spec0 auth login'.");
        }
        exit(ExitCode.GENERIC, `Status failed: ${(err as Error).message}`);
      }
    });
}

function renderStatusText(data: StatusPayload, keyName?: string): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`Org: ${data.orgName}`));
  lines.push(`API URL: ${data.apiUrl}`);
  if (keyName) lines.push(`Key: ${keyName}`);
  lines.push("");
  lines.push(`  APIs:         ${data.apiCount ?? "—"}`);
  lines.push(`  Mock servers: ${data.mockServerCount ?? data.mocks.length}`);
  lines.push(`  Teams:        ${data.teamCount ?? "—"}`);
  lines.push(`  Plan:         ${data.plan ?? "—"}`);

  if (data.mocks.length > 0) {
    lines.push("");
    lines.push(chalk.blue("Mock servers:"));
    lines.push(
      renderTable(data.mocks as unknown as Record<string, unknown>[], [
        {
          key: "apiName",
          header: "API",
          format: (_, row) => String(row.apiName ?? row.apiId ?? "—"),
        },
        { key: "name", header: "Mock name" },
        { key: "mockBaseUrl", header: "Base path" },
      ]),
    );
  }
  return lines.join("\n");
}
