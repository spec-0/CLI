/**
 * spec0 mcp url | test
 */

import { Command } from "commander";
import chalk from "chalk";
import got from "got";
import { getDefaultOrgId, getOrgConfig } from "../lib/config.js";

export function registerMcpCommands(program: Command) {
  const mcp = program.command("mcp").description("MCP server URL and config");

  mcp
    .command("url")
    .description("Print MCP server URL for Cursor/Claude config")
    .action(async () => {
      const orgId = process.env.PLATFORM_ORG_ID ?? getDefaultOrgId();
      if (!orgId || !getOrgConfig(orgId)) {
        console.error(chalk.red("Not authenticated. Run 'spec0 auth login'."));
        process.exit(1);
      }
      const org = getOrgConfig(orgId)!;
      const mcpUrl = `https://mcp.spec0.io/org/${orgId}/mcp`;
      console.log("Your MCP server URL:");
      console.log(`  ${mcpUrl}`);
      console.log("");
      console.log("Add to Cursor settings:");
      console.log(JSON.stringify({
        mcpServers: {
          spec0: {
            url: mcpUrl,
            apiKey: org.apiKey,
          },
        },
      }, null, 2));
    });

  mcp
    .command("test")
    .description("Verify MCP server is responding")
    .action(async () => {
      const orgId = process.env.PLATFORM_ORG_ID ?? getDefaultOrgId();
      if (!orgId || !getOrgConfig(orgId)) {
        console.error(chalk.red("Not authenticated. Run 'spec0 auth login'."));
        process.exit(1);
      }
      const org = getOrgConfig(orgId)!;
      const base = org.apiUrl.replace(/\/$/, "");
      const url = `${base}/mcp/org/${orgId}/health`;
      try {
        const res = await got.get(url, {
          headers: { Authorization: `Bearer ${org.apiKey}`, "X-Org-Id": orgId },
        });
        console.log(chalk.green("MCP gateway OK:"), res.body);
      } catch (e) {
        console.error(chalk.red("MCP health check failed:"), (e as Error).message);
        process.exit(1);
      }
    });
}
