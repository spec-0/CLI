/**
 * spec0 mock show <api> — structured view of a single mock server.
 *
 * Backend lacks a GET /mocks/{id} endpoint, so we fetch the full list and
 * filter client-side by API name or id. Cheap enough for any realistic org.
 */

import { Command } from "commander";
import chalk from "chalk";
import { createOrgApiClient, is401 } from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode, exit } from "../../lib/exit-codes.js";
import { emit, resolveOutputContext, type OutputOptions } from "../../lib/output/index.js";
import type { MockItem } from "./create.js";

interface MockShowResult {
  apiId?: string;
  apiName?: string;
  mockServerId?: string;
  name?: string;
  mockUrl: string;
}

export function registerMockShowCommand(mock: Command) {
  mock
    .command("show <api>")
    .description("Show details for the mock server tied to <api> (name or UUID).")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(async (api: string, opts: OutputOptions & { org?: string }) => {
      const outCtx = resolveOutputContext(opts);

      let authCtx;
      try {
        authCtx = requireOrgContext(opts.org);
      } catch (e) {
        exit(ExitCode.AUTH_MISSING, (e as Error).message);
      }

      const client = createOrgApiClient(authCtx);
      try {
        const rows = (await client.getJson("/api-management/cli/v1/mocks")) as MockItem[];
        const needle = api.toLowerCase();
        const hit = rows.find(
          (r) =>
            (r.apiName ?? "").toLowerCase() === needle || (r.apiId ?? "").toLowerCase() === needle,
        );
        if (!hit) {
          exit(ExitCode.NOT_FOUND, `No mock server found for '${api}'.`);
        }

        const result: MockShowResult = {
          apiId: hit.apiId,
          apiName: hit.apiName,
          mockServerId: hit.mockServerId,
          name: hit.name,
          mockUrl: `${authCtx.apiUrl}${hit.mockBaseUrl ?? ""}`,
        };

        emit(outCtx, result, renderShowText);
      } catch (err) {
        if (is401(err)) {
          exit(ExitCode.AUTH_MISSING, "Token invalid or expired. Run 'spec0 auth login'.");
        }
        exit(ExitCode.GENERIC, `mock show failed: ${(err as Error).message}`);
      }
    });
}

function renderShowText(r: MockShowResult): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`mock for ${r.apiName ?? r.apiId ?? "(unknown)"}`));
  lines.push("");
  lines.push(`  name:          ${r.name ?? "—"}`);
  lines.push(`  api id:        ${r.apiId ?? "—"}`);
  lines.push(`  mock server:   ${r.mockServerId ?? "—"}`);
  lines.push(`  mock url:      ${r.mockUrl}`);
  return lines.join("\n");
}
