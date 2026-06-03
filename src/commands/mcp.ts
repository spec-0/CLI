/**
 * spec0 mcp url | test | install
 *
 * Helpers for pointing MCP clients (Cursor, Claude) at the Spec0 MCP server.
 * The server is an SSE endpoint authenticated with a bearer token; the canonical
 * config references `${SPEC0_TOKEN}` so the secret stays in the environment rather
 * than being written into client config files.
 */

import { Command } from "commander";
import chalk from "chalk";
import got from "got";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { getDefaultOrgId, getOrgConfig } from "../lib/config.js";
import { resolvedPlatformMcpBaseUrl, resolvedPlatformMcpUrl } from "../lib/platform-defaults.js";
import { ExitCode, exit, exitCodeForHttpStatus } from "../lib/exit-codes.js";

/** Server key used under `mcpServers` in every client config we write. */
const SERVER_KEY = "spec0";

/** Bearer header value — references the env var so the token never lands on disk. */
const AUTH_HEADER = "Bearer ${SPEC0_TOKEN}";

/** Canonical client config block for the Spec0 MCP server. */
function canonicalServerConfig(mcpUrl: string) {
  return {
    url: mcpUrl,
    headers: { Authorization: AUTH_HEADER },
  };
}

/**
 * Exit early (code 3) unless the user is logged in or has env credentials.
 * Mirrors the sibling MCP commands: a default org from config, or SPEC0_TOKEN
 * with an org id, is enough.
 */
function requireAuthOrExit(): void {
  const orgId = process.env.SPEC0_ORG_ID ?? process.env.PLATFORM_ORG_ID ?? getDefaultOrgId();
  const hasEnvToken = Boolean(process.env.SPEC0_TOKEN ?? process.env.PLATFORM_API_TOKEN);
  const hasStoredOrg = Boolean(orgId && getOrgConfig(orgId));
  if (!hasEnvToken && !hasStoredOrg) {
    console.error(chalk.red("Not authenticated. Run 'spec0 auth login'."));
    exit(ExitCode.AUTH_MISSING);
  }
}

export function registerMcpCommands(program: Command) {
  const mcp = program.command("mcp").description("MCP server URL and config");

  mcp
    .command("url")
    .description("Print MCP server config for Cursor/Claude")
    .action(async () => {
      requireAuthOrExit();
      const mcpUrl = resolvedPlatformMcpUrl();
      console.log("Your MCP server URL:");
      console.log(`  ${mcpUrl}`);
      console.log("");
      console.log("Add to your MCP client config (e.g. Cursor):");
      console.log(
        JSON.stringify({ mcpServers: { [SERVER_KEY]: canonicalServerConfig(mcpUrl) } }, null, 2),
      );
      console.log("");
      console.log(
        chalk.dim("SPEC0_TOKEN must be set in the client's environment for auth to succeed."),
      );
    });

  mcp
    .command("test")
    .description("Verify MCP server is responding")
    .action(async () => {
      requireAuthOrExit();
      const url = `${resolvedPlatformMcpBaseUrl()}/health`;
      try {
        const res = await got.get(url);
        console.log(chalk.green("MCP gateway OK:"), res.body);
      } catch (e) {
        const status = (e as { response?: { statusCode?: number } })?.response?.statusCode;
        console.error(chalk.red("MCP health check failed:"), (e as Error).message);
        exit(status ? exitCodeForHttpStatus(status) : ExitCode.NETWORK_ERROR);
      }
    });

  mcp
    .command("install")
    .description("Install the Spec0 MCP server into Cursor and/or Claude")
    .option("--client <client>", "Target client: cursor, claude, or all", "all")
    .action(async (opts: { client: string }) => {
      requireAuthOrExit();

      const client = opts.client.toLowerCase();
      if (!["cursor", "claude", "all"].includes(client)) {
        console.error(
          chalk.red(`Unknown client '${opts.client}'. Expected: cursor, claude, or all.`),
        );
        exit(ExitCode.USAGE);
      }

      const mcpUrl = resolvedPlatformMcpUrl();
      if (client === "cursor" || client === "all") {
        installCursor(mcpUrl);
      }
      if (client === "claude" || client === "all") {
        installClaude(mcpUrl);
      }
    });
}

/**
 * Read-merge-write `~/.cursor/mcp.json`, setting `mcpServers.spec0` while
 * preserving any other servers already configured there. Creates the file/dir
 * when absent. Pretty-prints with a trailing newline.
 */
function installCursor(mcpUrl: string): void {
  const cursorConfigPath = join(homedir(), ".cursor", "mcp.json");

  let config: { mcpServers?: Record<string, unknown> } & Record<string, unknown> = {};
  if (existsSync(cursorConfigPath)) {
    try {
      const raw = readFileSync(cursorConfigPath, "utf-8").trim();
      if (raw) config = JSON.parse(raw);
    } catch {
      console.error(
        chalk.red(`Could not parse existing ${cursorConfigPath}; refusing to overwrite it.`),
      );
      console.error(chalk.dim("Fix or remove the file, then re-run 'spec0 mcp install'."));
      exit(ExitCode.GENERIC);
    }
  }

  const mcpServers = { ...(config.mcpServers ?? {}) };
  mcpServers[SERVER_KEY] = canonicalServerConfig(mcpUrl);
  const merged = { ...config, mcpServers };

  mkdirSync(dirname(cursorConfigPath), { recursive: true });
  writeFileSync(cursorConfigPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");

  console.log(chalk.green("Cursor:"), `wrote ${cursorConfigPath}`);
}

/**
 * Register the server with Claude via `claude mcp add`. The flag form follows the
 * current Claude CLI: all options precede the server name, the SSE transport is
 * selected explicitly, and the bearer header is passed verbatim so the
 * `${SPEC0_TOKEN}` placeholder is expanded by the client at connect time.
 *
 * If the `claude` binary isn't on PATH (or the invocation fails for any reason)
 * we don't hard-fail: we print the exact command plus the manual JSON so the user
 * can finish by hand.
 */
function installClaude(mcpUrl: string): void {
  const args = [
    "mcp",
    "add",
    "--transport",
    "sse",
    SERVER_KEY,
    mcpUrl,
    "--header",
    `Authorization: ${AUTH_HEADER}`,
  ];
  const printableCommand = `claude mcp add --transport sse ${SERVER_KEY} ${mcpUrl} --header "Authorization: ${AUTH_HEADER}"`;

  let result: ReturnType<typeof spawnSync> | undefined;
  try {
    result = spawnSync("claude", args, { stdio: "inherit" });
  } catch {
    // Swallow — handled by the fallback below (e.g. spawn error on some platforms).
  }

  if (result && result.error === undefined && result.status === 0) {
    console.log(chalk.green("Claude:"), "registered MCP server 'spec0'.");
    return;
  }

  // Binary missing or command failed — guide the user instead of failing hard.
  console.log(chalk.yellow("Claude:"), "could not run 'claude mcp add' automatically.");
  console.log("Run this command yourself:");
  console.log(`  ${printableCommand}`);
  console.log("");
  console.log("Or add this to your Claude MCP config manually:");
  console.log(
    JSON.stringify(
      { mcpServers: { [SERVER_KEY]: { type: "sse", ...canonicalServerConfig(mcpUrl) } } },
      null,
      2,
    ),
  );
}
