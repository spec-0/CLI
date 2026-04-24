/**
 * spec0 mock create — provision (or fetch) the default mock server for an API.
 *
 * The backend endpoint is idempotent: POST /api-management/cli/v1/mocks either
 * returns the existing mock or creates a fresh one. The API key is only ever
 * returned once (on initial creation), so CI callers should capture it on the
 * very first run — we surface it prominently in text mode and include it in
 * the JSON payload.
 */

import { Command } from "commander";
import chalk from "chalk";
import { createOrgApiClient, is401 } from "../../lib/api-client.js";
import { requireOrgContext } from "../../lib/auth-context.js";
import { ExitCode, exit } from "../../lib/exit-codes.js";
import { emit, resolveOutputContext, type OutputOptions } from "../../lib/output/index.js";
import type { components, paths } from "../../types.js";

type CreateMockRequest =
  paths["/api-management/cli/v1/mocks"]["post"]["requestBody"]["content"]["application/json"];
type CreateMockResponse =
  paths["/api-management/cli/v1/mocks"]["post"]["responses"][200]["content"]["application/json"];

interface CreateMockResult {
  apiId?: string;
  apiName?: string;
  mockUrl: string;
  apiKey?: string | null;
  created?: boolean;
}

export function registerMockCreateCommand(mock: Command) {
  mock
    .command("create")
    .description("Create (or fetch existing) mock server for an API; print URL and one-time key.")
    .option("--api <name>", "API name (required unless --api-id is set)")
    .option("--api-id <uuid>", "API id")
    .option("--org <uuid>", "Org id override")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action(async (opts: OutputOptions & { api?: string; apiId?: string; org?: string }) => {
      const outCtx = resolveOutputContext(opts);

      if (!opts.api && !opts.apiId) {
        exit(ExitCode.USAGE, "Provide --api <name> or --api-id <uuid>.");
      }

      let authCtx;
      try {
        authCtx = requireOrgContext(opts.org);
      } catch (e) {
        exit(ExitCode.AUTH_MISSING, (e as Error).message);
      }

      const client = createOrgApiClient(authCtx);
      const body: CreateMockRequest = {
        apiName: opts.api,
        apiId: opts.apiId,
      };

      try {
        const res = (await client.postJson(
          "/api-management/cli/v1/mocks",
          body,
        )) as CreateMockResponse;

        const result: CreateMockResult = {
          apiId: res.apiId,
          apiName: res.apiName,
          mockUrl: `${authCtx.apiUrl}${res.mockBaseUrl ?? ""}`,
          apiKey: res.apiKey ?? null,
          created: res.created,
        };

        emit(outCtx, result, renderCreateText);
      } catch (err) {
        if (is401(err)) {
          exit(ExitCode.AUTH_MISSING, "Token invalid or expired. Run 'spec0 auth login'.");
        }
        exit(ExitCode.GENERIC, `mock create failed: ${(err as Error).message}`);
      }
    });
}

function renderCreateText(r: CreateMockResult): string {
  const lines: string[] = [];
  lines.push(chalk.green(r.created ? "Mock server created:" : "Mock server (existing):"));
  lines.push(`  Mock URL:  ${r.mockUrl}`);
  if (r.apiKey) {
    lines.push(`  API Key:   ${r.apiKey}  ${chalk.yellow("(shown once — copy and keep safe)")}`);
  } else {
    lines.push(chalk.gray("  (API key was issued when the mock was first created.)"));
  }
  return lines.join("\n");
}

// Re-export shared item type so other mock commands don't re-declare it.
export type MockItem = components["schemas"]["MockItem"];
